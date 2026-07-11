"""FastAPI backend for the AI Cloud Cost Detective.

Bridges the React frontend and the Azure CLI for the resource-group selection
and scanning steps (②, ③), and adds:

  * step ④ — a WebSocket that streams live progress for an analysis run
  * step ⑥ — Azure PostgreSQL persistence of users and analysis history

The heavy lifting lives in :mod:`azure_scanner` and :mod:`ai_analyzer`; this
module wires up the HTTP/WebSocket surface, request validation, CORS, error
translation, and DB orchestration.
"""

from __future__ import annotations

import os
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Make sibling imports work whether launched from inside ``backend/``
# (``uvicorn main:app``) or from the repo root (``uvicorn backend.main:app``).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_analyzer import AIAnalyzerError, analyze_resources  # noqa: E402
from azure_scanner import AzureCLIError, list_resource_groups, scan_resource_group  # noqa: E402
from db import (  # noqa: E402
    create_analysis,
    finalize_analysis,
    get_or_create_user,
    get_user_analyses,
    init_db,
    is_available,
)

FRONTEND_ORIGIN = "http://localhost:5173"


class ProgressHub:
    """Routes progress messages to the WebSocket watching a given analysis_id."""

    def __init__(self) -> None:
        self._conns: dict[str, WebSocket] = {}

    async def connect(self, analysis_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._conns[analysis_id] = ws

    def disconnect(self, analysis_id: str) -> None:
        self._conns.pop(analysis_id, None)

    async def send(self, analysis_id: str, message: str) -> None:
        ws = self._conns.get(analysis_id)
        if ws is None:
            return  # no listener connected (yet) — progress is best-effort
        try:
            await ws.send_json({"message": message, "analysis_id": analysis_id})
        except Exception:
            # Client gone or socket broken — drop it so we don't leak.
            self._conns.pop(analysis_id, None)


hub = ProgressHub()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AI Cloud Cost Detective API",
    version="0.1.0",
    description="Backend that bridges the React frontend and the Azure CLI.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    """Request body for ``POST /api/analyze``."""

    resource_group: str = Field(..., min_length=1, description="Name of the Azure resource group to scan.")
    analysis_id: Optional[str] = Field(
        default=None,
        description=(
            "Client-generated UUID that correlates the WebSocket progress stream "
            "with this run. The frontend opens /ws/progress/{analysis_id} first, "
            "then sends this id. Generated server-side when omitted."
        ),
    )


def _user_email(x_user_email: Optional[str]) -> str:
    """Resolve the acting user; falls back to a demo user when no auth header."""
    return (x_user_email or "").strip() or "demo@example.com"


@app.get("/")
def root() -> dict:
    return {
        "service": "AI Cloud Cost Detective API",
        "status": "ok",
        "database": "connected" if is_available() else "disabled",
    }


@app.get("/api/resource-groups")
def get_resource_groups() -> dict:
    """List every Azure resource group (step ②: user picks one)."""
    try:
        groups = list_resource_groups()
    except AzureCLIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"resource_groups": groups, "count": len(groups)}


@app.post("/api/analyze")
async def analyze(
    request: AnalyzeRequest,
    x_user_email: Optional[str] = Header(default=None),
):
    """Scan a resource group, run the AI cost analysis, persist it, and stream progress.

    Steps ③ (scan) and ⑤ (AI) are blocking, so they run in a threadpool; the
    surrounding async wrapper lets us emit WebSocket progress between stages.
    """
    resource_group = request.resource_group.strip()
    if not resource_group:
        raise HTTPException(status_code=422, detail="resource_group must not be empty.")

    email = _user_email(x_user_email)
    user_id = await run_in_threadpool(get_or_create_user, email)
    analysis_id = request.analysis_id or str(uuid.uuid4())
    await run_in_threadpool(create_analysis, analysis_id, user_id, resource_group)

    await hub.send(analysis_id, "Fetching resource groups...")

    try:
        await hub.send(analysis_id, f"Scanning resources in {resource_group}...")
        result = await run_in_threadpool(scan_resource_group, resource_group)
    except AzureCLIError as exc:
        await hub.send(analysis_id, f"Error: {exc.message}")
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await hub.send(analysis_id, "Analyzing costs with AI...")
    try:
        analysis = await run_in_threadpool(analyze_resources, result["resources"])
    except AIAnalyzerError as exc:
        await hub.send(analysis_id, f"Error: {exc.message}")
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    await hub.send(analysis_id, "Storing results...")
    await run_in_threadpool(
        finalize_analysis,
        analysis_id,
        result["resource_count"],
        len(analysis.get("issues") or []),
        analysis.get("estimated_savings"),
        analysis,
    )

    await hub.send(analysis_id, "Analysis complete")

    return {
        "analysis_id": analysis_id,
        "resource_group": result["resource_group"],
        "resource_count": result["resource_count"],
        "resources": result["resources"],
        "analysis": analysis,
    }


@app.get("/api/history")
async def history(x_user_email: Optional[str] = Header(default=None)):
    """Return past analyses for the authenticated user, newest first."""
    email = _user_email(x_user_email)
    rows = await run_in_threadpool(get_user_analyses, email)
    return {"analyses": rows, "count": len(rows)}


@app.websocket("/ws/progress/{analysis_id}")
async def ws_progress(websocket: WebSocket, analysis_id: str):
    """Stream live progress for the analysis run identified by ``analysis_id``.

    The frontend connects here first (with a client-generated id), then POSTs
    ``/api/analyze`` carrying the same id. We accept, hold the socket open, and
    let the analyze flow push progress messages to it.
    """
    await hub.connect(analysis_id, websocket)
    try:
        # Keep the connection alive; the analyze flow drives the messages.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.disconnect(analysis_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
