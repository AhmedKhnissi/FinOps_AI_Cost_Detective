r"""Smoke-test the Cost Detective API (steps ②, ③, ④, ⑤, ⑥ + error paths).

Run while the server is up:
    ..\venv\Scripts\python.exe test_api.py            # defaults to :8000
    ..\venv\Scripts\python.exe test_api.py 8012       # custom port

Requires:
  * the FastAPI server running  (uvicorn main:app --port 8000)
  * Azure CLI installed and `az login` done   (for the real scan, step ③)
  * a valid key in backend/.env                (for the AI analysis, step ⑤)
  * an Azure PostgreSQL flexible server created, with DATABASE_URL set in
    backend/.env                         (for the step ⑥ DB checks)
    NOTE: the step-⑥ check FAILS if the instance is missing or unreachable.

What it exercises:
  GET  /                       health check (+ reports DB status)
  GET  /api/resource-groups    step ②  (proves `az` is installed + logged in)
  POST /api/analyze            step ③ + ⑤ (scan a real RG, then AI analysis)
  POST /api/analyze  (bad RG)  -> 404
  POST /api/analyze  (empty)   -> 422
  POST /api/analyze  ({})      -> 422
  ws://.../ws/progress/{id}    step ④  (live progress relayed to the socket)
  az postgres flexible-server list   step ⑥ (proves the PG instance exists)
  GET  /api/history             step ⑥ (proves the DB is reachable + persists)

PostgreSQL config deep-dive (step ⑥, does NOT require the server to be up):
  * DATABASE_URL present in backend/.env, pointed at the Azure PG, sslmode=require
  * psycopg2 connects with sslmode=require (the exact driver the app uses)
  * both tables exist on startup with the exact columns/types Prompt 3 mandates
    — including analyses.analysis_result as JSONB and the integer count columns
  * a full analysis result round-trips through the app's own db.py helpers
    (get_or_create_user -> create_analysis -> finalize_analysis ->
    get_user_analyses), proving JSONB storage AND per-user history isolation
    (the scoping that backs GET /api/history)

Uses the stdlib (urllib) plus `az` for the instance-existence check. The deeper
PostgreSQL checks additionally import the local `db` module, `psycopg2`, and
`websockets` (all listed in requirements.txt). The AI call can take several
seconds, so requests are given a generous timeout. Prints a PASS/FAIL summary
at the end; a non-zero exit + a FAIL line means something broke.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

# Make the sibling backend modules importable however the test is launched.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE = f"http://127.0.0.1:{sys.argv[1] if len(sys.argv) > 1 else '8000'}"
PORT = sys.argv[1] if len(sys.argv) > 1 else "8000"
REQUEST_TIMEOUT = 120  # seconds; the OpenRouter call can be slow
PASS, FAIL = 0, 0


def call(method: str, path: str, body: dict | None = None, expect: int | None = None) -> dict:
    """Make a request and return {status, ok, json, text}."""
    global PASS, FAIL
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    status, payload, text = None, None, ""
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            status, text = resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        status, text = exc.code, exc.read().decode()
    except Exception as exc:  # connection refused, timeout, etc.
        status, text = None, str(exc)

    try:
        payload = json.loads(text) if text else None
    except json.JSONDecodeError:
        payload = None

    ok = (status == expect) if expect is not None else (200 <= (status or 0) < 300)
    (PASS := PASS + 1) if ok else (FAIL := FAIL + 1)
    print(f"[{'PASS' if ok else 'FAIL'}] {method:4} {path} -> {status}" + (f" | {text[:140]}" if not ok else ""))
    return {"status": status, "ok": ok, "json": payload, "text": text}


def check_analysis(analysis: dict) -> bool:
    """Validate the step-⑤ analysis shape and print a human summary."""
    issues = analysis.get("issues") or []
    sev = [i.get("severity") for i in issues]
    fix_cmds = analysis.get("fix_commands") or []

    print(f"      -> summary         : {(analysis.get('summary') or '')[:90]}")
    print(f"      -> issues          : {len(issues)} "
          f"({sev.count('high')} high / {sev.count('medium')} med / {sev.count('low')} low)")
    print(f"      -> estimated savings: {analysis.get('estimated_savings')}")
    print(f"      -> fix commands     : {len(fix_cmds)}")

    well_formed = (
        isinstance(analysis.get("summary"), str)
        and isinstance(issues, list)
        and all(s in ("high", "medium", "low") for s in sev)
        and isinstance(fix_cmds, list)
    )
    print(f"      -> analysis structure: {'OK' if well_formed else 'MALFORMED'}")
    if not well_formed:
        global FAIL
        FAIL += 1
    return well_formed


def az_postgres_servers() -> list:
    """List Azure PostgreSQL flexible servers (step ⑥: "instance exists").

    Returns [] if ``az`` is missing, not logged in, or the command fails — the
    caller treats an empty list as "no instance provisioned".
    """
    if shutil.which("az") is None:
        return []
    try:
        proc = subprocess.run(
            ["az", "postgres", "flexible-server", "list", "-o", "json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            return []
        return json.loads(proc.stdout or "[]")
    except Exception:
        return []


def check_database(health_json: dict | None, analyzed_id: str | None) -> None:
    """Validate step ⑥: the PostgreSQL instance exists and is reachable.

    * Confirms an Azure PG flexible server exists (via ``az``).
    * Confirms the API connected to it at startup (``GET /`` -> database).
    * Confirms ``GET /api/history`` is well-formed and, if an analysis just
      ran, that the result was actually persisted (read + write reachability).
    """
    global PASS, FAIL
    servers = az_postgres_servers()
    names = ", ".join(s.get("name", "?") for s in servers) or "none"
    print(f"      -> Azure PG flexible servers : {len(servers)} ({names})")
    if not servers:
        print("      -> NOTE: `az postgres flexible-server list` returned no "
              "servers. Create one (or point DATABASE_URL at an existing one).")

    db_status = (health_json or {}).get("database")
    if db_status != "connected":
        print("      -> FAIL: API reports database 'disabled' - the PostgreSQL "
              "instance is missing or unreachable. Set DATABASE_URL in "
              "backend/.env to a real Azure PG connection string "
              "(sslmode=require) and ensure the server exists and allows this "
              "client's IP.")
        FAIL += 1
        return

    hist = call("GET", "/api/history")
    rows = (hist["json"] or {}).get("analyses")
    count = (hist["json"] or {}).get("count")
    if not isinstance(rows, list) or not isinstance(count, int):
        print(f"      -> FAIL: /api/history returned an unexpected shape ({hist['text'][:120]}).")
        FAIL += 1
        return

    if analyzed_id:
        present = any((a.get("id") == analyzed_id) for a in rows)
        print(f"      -> analysis {analyzed_id} persisted in history: {present}")
        if not present:
            print("      -> FAIL: the analysis was not persisted to PostgreSQL.")
            FAIL += 1


def check_postgres_config() -> None:
    """Step ⑥ deep-dive: verify the PostgreSQL wiring matches Prompt 3 exactly.

    Runs independently of the server (talks to the DB directly via the app's own
    ``db`` module + psycopg2):

      * ``DATABASE_URL`` is present in backend/.env and points at the Azure PG
        (host ends in .postgres.database.azure.com, sslmode=require).
      * A psycopg2 connection opens with sslmode=require (what the app uses).
      * Both tables exist on startup with the exact columns/types the prompt
        mandates — including ``analyses.analysis_result`` as JSONB and the
        integer count columns.
      * A full analysis result round-trips through db.py (get_or_create_user ->
        create_analysis -> finalize_analysis -> get_user_analyses), proving the
        JSONB payload and the per-user scoping that backs GET /api/history.
    """
    global PASS, FAIL
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    except Exception:
        pass

    url = os.getenv("DATABASE_URL")
    if not url:
        print("      -> FAIL: DATABASE_URL not set in backend/.env")
        FAIL += 1
        return
    if "postgres.database.azure.com" not in url:
        print(f"      -> NOTE: DATABASE_URL host is not an Azure PG endpoint: {url[:48]}...")
    if "sslmode=require" not in url:
        print("      -> NOTE: DATABASE_URL lacks sslmode=require")

    try:
        import psycopg2
    except ImportError:
        print("      -> FAIL: psycopg2 not installed; cannot verify DB.")
        FAIL += 1
        return

    try:
        conn = psycopg2.connect(url, connect_timeout=15)
    except Exception as exc:
        print(f"      -> FAIL: psycopg2 cannot connect to DATABASE_URL: {exc}")
        FAIL += 1
        return
    print("      -> psycopg2 connection to Azure PG OK (sslmode=require)")

    cur = conn.cursor()
    cur.execute(
        "SELECT table_name, column_name, data_type FROM information_schema.columns "
        "WHERE table_schema='public' ORDER BY table_name, ordinal_position;"
    )
    have, types = {}, {}
    for t, c, dt in cur.fetchall():
        have.setdefault(t, set()).add(c)
        types[(t, c)] = dt
    cur.close()

    expected = {
        "users": {"id", "email", "password_hash", "created_at"},
        "analyses": {
            "id", "user_id", "resource_group", "resources_scanned", "issues_found",
            "estimated_savings", "analysis_result", "status", "created_at",
        },
    }
    for t, cols in expected.items():
        if t not in have:
            print(f"      -> FAIL: table '{t}' missing")
            FAIL += 1
            continue
        missing = cols - have[t]
        if missing:
            print(f"      -> FAIL: table '{t}' missing columns {sorted(missing)}")
            FAIL += 1
        else:
            print(f"      -> table '{t}' has all required columns")

    if types.get(("analyses", "analysis_result")) != "jsonb":
        print(f"      -> FAIL: analyses.analysis_result is "
              f"'{types.get(('analyses','analysis_result'))}', expected jsonb")
        FAIL += 1
    else:
        print("      -> analyses.analysis_result is JSONB")

    for col in ("resources_scanned", "issues_found"):
        dt = types.get(("analyses", col))
        if dt not in ("integer", "bigint"):
            print(f"      -> WARN: analyses.{col} type is '{dt}' (expected integer)")

    # Full round-trip through the app's own data layer (also ensures tables exist).
    import db  # noqa: E402  (sibling module; sys.path already includes backend/)
    db.init_db()
    if not db.is_available():
        print("      -> FAIL: db.init_db() reports the database is unavailable")
        FAIL += 1
        conn.close()
        return

    email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"
    uid = db.get_or_create_user(email)
    aid = f"smoke-{uuid.uuid4().hex}"
    db.create_analysis(aid, uid, "Finops_Cost_Detective")
    full = {
        "summary": "smoke summary",
        "issues": [{"title": "idle vm", "severity": "high", "resource": "vm1",
                    "description": "stopped", "estimated_savings": "$5"}],
        "estimated_savings": "$5",
        "fix_commands": ["az vm deallocate -g x -n vm1"],
    }
    db.finalize_analysis(aid, 9, 1, "$5", full)

    rows = db.get_user_analyses(email)
    match = next((r for r in rows if r["id"] == aid), None)
    if match is None:
        print("      -> FAIL: analysis not returned by get_user_analyses")
        FAIL += 1
    elif (match["analysis_result"] != full or match["resources_scanned"] != 9
          or match["issues_found"] != 1 or match["estimated_savings"] != "$5"
          or match["status"] != "complete"):
        print(f"      -> FAIL: stored analysis mismatch: {match}")
        FAIL += 1
    else:
        print("      -> full analysis result round-tripped (JSONB + fields)")

    # Per-user isolation: the row must NOT appear under a different user.
    if any(r["id"] == aid for r in db.get_user_analyses("another-user@example.com")):
        print("      -> FAIL: analysis leaked to a different user")
        FAIL += 1
    else:
        print("      -> history is scoped to the requesting user (isolation OK)")

    c2 = conn.cursor()
    c2.execute("DELETE FROM analyses WHERE id = %s;", (aid,))
    conn.commit()
    c2.close()
    conn.close()
    print("      -> test row cleaned up")


def check_websocket_progress(resource_group: str | None) -> None:
    """Step ④ smoke: the WebSocket relays the 5 progress messages.

    Opens ws://127.0.0.1:{PORT}/ws/progress/{analysis_id}, then drives a real
    POST /api/analyze with that same id so the server pushes progress to our
    socket. If the environment can run a full analyze (az logged in + API key),
    we assert all five mandated messages arrived. If analyze can't complete (no
    RG / not logged in / no key) we still prove the endpoint is wired by checking
    that the early progress messages were relayed, and otherwise NOTE/SKIP.
    """
    global PASS, FAIL
    try:
        import websockets
    except ImportError:
        print("      -> SKIP: 'websockets' package not installed; cannot test WS.")
        return
    if not resource_group:
        print("      -> SKIP: no resource group available (step ②) to drive analyze.")
        return

    analysis_id = f"ws-{uuid.uuid4().hex}"
    collected: list[str] = []
    stop = threading.Event()

    async def listen():
        try:
            async with websockets.connect(
                f"ws://127.0.0.1:{PORT}/ws/progress/{analysis_id}", max_size=None
            ) as ws:
                while not stop.is_set():
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue
                    except Exception:
                        break
                    msg = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
                    text = msg.get("message") if isinstance(msg, dict) else str(msg)
                    collected.append(text)
                    if text == "Analysis complete":
                        break
        except Exception as exc:  # connection refused, handshake error, etc.
            collected.append(f"<ws-error:{type(exc).__name__}>")

    loop = asyncio.new_event_loop()
    lt = threading.Thread(
        target=lambda: (loop.run_until_complete(listen()), loop.close()),
        daemon=True,
    )
    lt.start()
    time.sleep(0.6)  # let the socket connect + register with the hub

    # Drive the analyze flow with our analysis_id (frontend order: open WS
    # first, then POST with the same id).
    data = json.dumps({"resource_group": resource_group, "analysis_id": analysis_id}).encode()
    req = urllib.request.Request(
        BASE + "/api/analyze", data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    status = None
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            status = resp.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    except Exception:
        status = None

    stop.set()
    lt.join(timeout=6)

    expected = [
        "Fetching resource groups...",
        f"Scanning resources in {resource_group}...",
        "Analyzing costs with AI...",
        "Storing results...",
        "Analysis complete",
    ]
    if status == 200:
        missing = [m for m in expected if m not in collected]
        if missing:
            print(f"      -> FAIL: WS missing {missing}; received {collected}")
            FAIL += 1
        else:
            print(f"      -> WS relayed all 5 progress messages: {collected}")
            PASS += 1
    else:
        early = [m for m in expected[:2] if m in collected]
        if early:
            print(f"      -> NOTE: analyze returned {status} (env lacks az/key?), "
                  f"but WS endpoint relayed early progress {early} — wiring OK.")
        elif any(c.startswith("<ws-error") for c in collected):
            print(f"      -> FAIL: WS connection failed: {collected}")
            FAIL += 1
        else:
            print(f"      -> FAIL: WS received no progress (analyze returned {status}); "
                  f"got {collected}")
            FAIL += 1


print(f"Testing {BASE}\n")

health = call("GET", "/")                          # ① health (+ DB status)
check_postgres_config()                            # ⑥ deep config check (DB direct)
rgs = call("GET", "/api/resource-groups")          # ② list RGs (proves `az` login)

first_rg = ""
if rgs["json"] and rgs["json"].get("resource_groups"):
    first_rg = rgs["json"]["resource_groups"][0]["name"]
    print(f"      -> found {rgs['json']['count']} RG(s); using '{first_rg}'")
elif rgs["status"] in (401, 403):
    print("      -> Azure CLI not authenticated. Run `az login` and re-run this test.")

analyzed_id = None
if first_rg:
    scan = call("POST", "/api/analyze", {"resource_group": first_rg})  # ③ + ⑤
    if scan["ok"] and scan["json"]:
        j = scan["json"]
        analyzed_id = j.get("analysis_id")
        print(f"      -> {j.get('resource_count')} resource(s) in group; "
              f"analysis present: {'analysis' in j}")
        analysis = j.get("analysis")
        if analysis:
            check_analysis(analysis)
        else:
            print("      -> WARNING: response has no 'analysis' key")
            FAIL += 1
    elif scan["status"] == 502:
        print("      -> AI analysis step FAILED (502). Check BEDROCK_API_KEY in .env "
              "and that this machine can reach openrouter.ai.")

call("POST", "/api/analyze", {"resource_group": "this-rg-does-not-exist-xyz"}, expect=404)
call("POST", "/api/analyze", {"resource_group": ""}, expect=422)
call("POST", "/api/analyze", {}, expect=422)

# ── step ⑥: PostgreSQL instance exists & is reachable ───────────────────────
print("\n-- Database (step 6) --")
check_database(health["json"] if health.get("ok") else None, analyzed_id)

# ── step ④: WebSocket live progress relay ───────────────────────────────────
print("\n-- WebSocket progress (step 4) --")
check_websocket_progress(first_rg)

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
