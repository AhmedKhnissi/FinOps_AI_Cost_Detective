r"""Smoke-test the Cost Detective API (steps ②, ③, ⑤, ⑥ + error paths).

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
  az postgres flexible-server list   step ⑥ (proves the PG instance exists)
  GET  /api/history             step ⑥ (proves the DB is reachable + persists)

Uses only the stdlib (urllib) plus `az` for the instance-existence check. The
AI call can take several seconds, so requests are given a generous timeout.
Prints a PASS/FAIL summary at the end; a non-zero exit + a FAIL line means
something broke.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

BASE = f"http://127.0.0.1:{sys.argv[1] if len(sys.argv) > 1 else '8000'}"
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


print(f"Testing {BASE}\n")

health = call("GET", "/")                          # ① health (+ DB status)
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

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
