r"""Smoke-test the Cost Detective API.

Run while the server is up:
    ..\venv\Scripts\python.exe test_api.py            # defaults to :8000
    ..\venv\Scripts\python.exe test_api.py 8012       # custom port

Exercises every endpoint + the error paths (missing CLI, bad RG, empty body)
and prints a PASS/FAIL summary. Uses only the stdlib (urllib).
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = f"http://127.0.0.1:{sys.argv[1] if len(sys.argv) > 1 else '8000'}"
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
        with urllib.request.urlopen(req) as resp:
            status, text = resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        status, text = exc.code, exc.read().decode()
    except Exception as exc:  # connection refused etc.
        status, text = None, str(exc)

    try:
        payload = json.loads(text) if text else None
    except json.JSONDecodeError:
        payload = None

    ok = (status == expect) if expect is not None else (200 <= (status or 0) < 300)
    mark = "PASS" if ok else "FAIL"
    (PASS := PASS + 1) if ok else (FAIL := FAIL + 1)
    print(f"[{mark}] {method:4} {path} -> {status}" + (f" | {text[:90]}" if not ok else ""))
    return {"status": status, "ok": ok, "json": payload, "text": text}


print(f"Testing {BASE}\n")

call("GET", "/")                                   # health
rgs = call("GET", "/api/resource-groups")          # list RGs

first_rg = ""
if rgs["json"] and rgs["json"].get("resource_groups"):
    first_rg = rgs["json"]["resource_groups"][0]["name"]
    print(f"      -> found {rgs['json']['count']} RG(s); using '{first_rg}'")

if first_rg:
    scan = call("POST", "/api/analyze", {"resource_group": first_rg})
    if scan["json"]:
        print(f"      -> {scan['json'].get('resource_count')} resource(s) in group")

call("POST", "/api/analyze", {"resource_group": "this-rg-does-not-exist-xyz"}, expect=404)
call("POST", "/api/analyze", {"resource_group": ""}, expect=422)
call("POST", "/api/analyze", {}, expect=422)

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
