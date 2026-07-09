"""FastAPI backend for the AI Cloud Cost Detective.

Exposes the resource-group selection and resource-scanning steps (② and ③ of
the request flow) that sit between the React frontend and the Azure CLI. The
heavy lifting lives in :mod:`azure_scanner`; this module only wires up the
HTTP surface, request validation, CORS, and error translation.
"""

from __future__ import annotations

import os
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Make sibling imports work whether the app is launched from inside ``backend/``
# (``uvicorn main:app``) or from the repo root (``uvicorn backend.main:app``).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from azure_scanner import AzureCLIError, list_resource_groups, scan_resource_group  # noqa: E402

FRONTEND_ORIGIN = "http://localhost:5173"

app = FastAPI(
    title="AI Cloud Cost Detective API",
    version="0.1.0",
    description="Backend that bridges the React frontend and the Azure CLI.",
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


@app.get("/")
def root() -> dict:
    return {"service": "AI Cloud Cost Detective API", "status": "ok"}


@app.get("/api/resource-groups")
def get_resource_groups() -> dict:
    """List every Azure resource group (step ②: user picks one)."""
    try:
        groups = list_resource_groups()
    except AzureCLIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"resource_groups": groups, "count": len(groups)}


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict:
    """Scan a resource group and return its resources (step ③)."""
    resource_group = request.resource_group.strip()
    if not resource_group:
        raise HTTPException(status_code=422, detail="resource_group must not be empty.")

    try:
        result = scan_resource_group(resource_group)
    except AzureCLIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
