"""AI-powered Azure cost analysis (step ⑤ of the request flow).

Takes the structured list of Azure resources produced by
:mod:`azure_scanner` and asks an OpenAI-compatible chat model to flag
cost problems: over-provisioning, idle/unused resources, misconfigurations,
wrong pricing tiers, and concrete optimization opportunities. The model
returns a structured analysis (summary, severity-ranked issues, estimated
savings, and runnable Azure CLI fix commands).

Provider note
-------------
The assignment text references "Bedrock", but the supplied key
(``sk-or-v1-…``) is an **OpenRouter** key. AWS Bedrock authenticates with
SigV4 access/secret keys, never a bearer ``sk-`` token, so that key cannot
talk to Bedrock. OpenRouter exposes an OpenAI-compatible Chat Completions
API, so we drive it through the ``openai`` SDK pointed at OpenRouter's base
URL. This also matches :mod:`Architecture` and :mod:`RequestFlow`, which
both place an OpenAI-compatible API at step ⑤.

The key is read from the environment. We honour the ``BEDROCK_API_KEY``
name from the project spec, but also accept ``OPENROUTER_API_KEY`` /
``OPENAI_API_KEY`` so a mislabelled ``.env`` still works.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

# Pull BEDROCK_API_KEY / AI_MODEL / OPENROUTER_BASE_URL out of backend/.env
# (if present) before anything reads os.environ. Pointing at __file__ keeps
# it working whether the app is launched from backend/ or the repo root.
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:  # python-dotenv missing — env vars must be set in the shell
    pass

# OpenRouter's OpenAI-compatible endpoint. Overridable via env for testing
# or if you ever point this at a different OpenAI-compatible gateway.
_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"

# Cheapest generally-available model on OpenRouter that reliably honours
# JSON mode. Swap via the AI_MODEL env var if you want a stronger/cheaper one.
_DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct"

_SEVERITIES = {"high", "medium", "low"}


class AIAnalyzerError(Exception):
    """Raised when the AI analysis step cannot produce a result.

    ``status_code`` maps onto the HTTP code :mod:`main` should return and
    ``detail`` is an optional machine-readable tag.
    """

    def __init__(self, message: str, *, status_code: int = 502, detail: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail


def _get_api_key() -> str:
    """Resolve the provider key, trying the spec name then common aliases."""
    for env_key in ("BEDROCK_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY"):
        value = os.getenv(env_key)
        if value and value.strip():
            return value.strip()
    raise AIAnalyzerError(
        "No AI provider API key found. Set BEDROCK_API_KEY (or OPENROUTER_API_KEY / "
        "OPENAI_API_KEY) in your environment or .env file.",
        status_code=500,
        detail="missing_api_key",
    )


def _build_messages(resources: List[Dict[str, Any]]):
    """Construct the system + user chat messages for the analysis request."""
    system = (
        "You are a FinOps cloud cost optimization expert specializing in Microsoft Azure. "
        "You analyze an inventory of Azure resources and identify actionable cost savings. "
        "Respond ONLY with a single valid JSON object and nothing else."
    )

    user = (
        "Analyze the following Azure resources for cost optimization. Look specifically for:\n"
        "1. Over-provisioning (SKUs/VM sizes larger than the workload needs).\n"
        "2. Unused or idle resources (stopped VMs, empty disks, unattached IPs/NICs, "
        "unused ExpressRoute/circuits).\n"
        "3. Misconfigurations (no tags, public exposure, missing lifecycle policies on storage).\n"
        "4. Wrong pricing tiers (not using reserved instances, savings plans, or dev/test "
        "pricing where eligible; premium-tier services that could be standard).\n"
        "5. Any other cost optimization opportunities.\n\n"
        "For each issue provide a severity of 'high', 'medium', or 'low', the affected "
        "resource (name or id if known, otherwise null), and a short description. Provide a "
        "rough estimated monthly savings string (e.g. '$40/mo' or 'unknown') per issue and an "
        "overall estimated monthly savings string. Also provide a list of ready-to-run Azure "
        "CLI ('az ...') commands the user can execute to fix the issues.\n\n"
        "Return JSON with exactly this shape:\n"
        "{\n"
        '  "summary": "string overview of the cost posture",\n'
        '  "issues": [{"title": "string", "severity": "high|medium|low", '
        '"resource": "string|null", "description": "string", "estimated_savings": "string|null"}],\n'
        '  "estimated_savings": "string overall monthly savings estimate",\n'
        '  "fix_commands": ["string az command", "..."]\n'
        "}\n\n"
        "Azure resources:\n"
        f"{json.dumps(resources, indent=2, default=str)}"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _extract_json(text: str) -> Dict[str, Any]:
    """Parse a JSON object out of the model response, tolerating prose wrappers."""
    if not text:
        raise AIAnalyzerError("The model returned an empty response.", detail="empty_response")

    text = text.strip()
    # Most models return a fenced ```json ... ``` block or bare JSON.
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back to grabbing the first balanced-looking {...} span.
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group(0))
        except json.JSONDecodeError as exc:
            raise AIAnalyzerError(
                "Could not parse the model's JSON response.",
                detail="invalid_json",
            ) from exc

    raise AIAnalyzerError("The model response did not contain a JSON object.", detail="no_json")


def _normalize(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce the model's JSON into a clean, predictable structure."""
    issues: List[Dict[str, Any]] = []
    for item in raw.get("issues") or []:
        if not isinstance(item, dict):
            continue
        severity = str(item.get("severity", "medium")).lower()
        if severity not in _SEVERITIES:
            severity = "medium"
        issues.append(
            {
                "title": str(item.get("title", "Untitled issue")),
                "severity": severity,
                "resource": item.get("resource"),
                "description": str(item.get("description", "")),
                "estimated_savings": item.get("estimated_savings"),
            }
        )

    fix_commands = [
        str(cmd).strip()
        for cmd in (raw.get("fix_commands") or [])
        if str(cmd).strip().lower().startswith("az")
    ]

    return {
        "summary": str(raw.get("summary", "")),
        "issues": issues,
        "estimated_savings": raw.get("estimated_savings"),
        "fix_commands": fix_commands,
    }


def analyze_resources(
    resources: List[Dict[str, Any]],
    *,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Run a cost analysis over ``resources`` and return the structured result.

    ``resources`` is the ``resources`` list emitted by
    :func:`azure_scanner.scan_resource_group`. The provider key, base URL, and
    model default to environment values but can be injected directly (handy for
    tests). Raises :class:`AIAnalyzerError` on any failure.
    """
    if not resources:
        # Nothing to analyze: return an empty-but-valid structure rather than
        # burning a model call.
        return {
            "summary": "No resources found in the selected resource group.",
            "issues": [],
            "estimated_savings": None,
            "fix_commands": [],
        }

    api_key = api_key or _get_api_key()
    base_url = base_url or os.getenv("OPENROUTER_BASE_URL", _DEFAULT_BASE_URL)
    model = model or os.getenv("AI_MODEL", _DEFAULT_MODEL)

    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise AIAnalyzerError(
            "The 'openai' package is not installed. Run 'pip install -r requirements.txt'.",
            status_code=500,
            detail="missing_dependency",
        ) from exc

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
        completion = client.chat.completions.create(
            model=model,
            messages=_build_messages(resources),
            temperature=0.2,
            response_format={"type": "json_object"},
        )
    except Exception as exc:  # network, auth, rate-limit, unsupported model, etc.
        raise AIAnalyzerError(
            f"AI provider request failed: {exc}",
            status_code=502,
            detail="provider_error",
        ) from exc

    content = completion.choices[0].message.content if completion.choices else None
    raw = _extract_json(content or "")
    return _normalize(raw)
