"""Azure resource scanning via the Azure CLI.

This module is the single integration point with the Azure CLI (``az``).
It shells out through :mod:`subprocess`, parses the JSON the CLI emits, and
maps CLI failures (CLI missing, not logged in, bad resource group) onto a
single :class:`AzureCLIError` so the API layer can translate them into the
right HTTP status codes.

This backs step ③ of the request flow: the Python backend fetches every
resource inside a user-selected Azure resource group.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any, Dict, List, Optional

# Azure CLI error signatures (matched case-insensitively against stderr).
_LOGIN_HINTS = ("az login", "not logged in", "please run", "get token request returned")
_RG_NOT_FOUND_HINTS = ("could not be found", "does not exist", "resource group", "not found")
_AUTHORIZATION_HINTS = ("authorization failed", "forbidden", "denied", "not authorized", "rbac")


class AzureCLIError(Exception):
    """Raised when an Azure CLI command fails in a user-facing way.

    ``status_code`` is the HTTP status the API should return and ``detail`` is
    an optional machine-readable explanation surfaced alongside the message.
    """

    def __init__(self, message: str, *, status_code: int = 500, detail: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail


def _resolve_az() -> str:
    """Locate the ``az`` executable, raising if it is missing."""
    az_path = shutil.which("az")
    if az_path is None:
        raise AzureCLIError(
            "Azure CLI ('az') is not installed or not on your PATH. "
            "Install it from https://learn.microsoft.com/cli/azure/install-azure-cli",
            status_code=500,
            detail="az_command_not_found",
        )
    return az_path


def _run_az(args: List[str]) -> Any:
    """Execute ``az <args> -o json`` and return the parsed JSON payload.

    Raises :class:`AzureCLIError` for a missing CLI, a non-zero exit, or
    output that is not valid JSON. We invoke the resolved ``az`` path directly
    (no ``shell=True``) so a missing CLI is reported explicitly and user input
    can never be interpreted by a shell.
    """
    az_path = _resolve_az()

    try:
        proc = subprocess.run(
            [az_path, *args, "-o", "json"],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception as exc:  # pragma: no cover - defensive; shell spawn failures
        raise AzureCLIError(f"Failed to execute the Azure CLI: {exc}") from exc

    if proc.returncode != 0:
        _raise_for_cli_error(proc.stderr or proc.stdout or "Azure CLI returned no output.")

    if not proc.stdout.strip():
        # Some commands (e.g. an empty resource group) print nothing.
        return None

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise AzureCLIError(
            f"Could not parse the Azure CLI response: {exc}",
            detail="invalid_json",
        ) from exc


def _raise_for_cli_error(stderr: str) -> None:
    """Translate a non-zero Azure CLI result into a typed :class:`AzureCLIError`."""
    lowered = (stderr or "").lower()

    if any(hint in lowered for hint in _LOGIN_HINTS):
        raise AzureCLIError(
            "Not authenticated with Azure. Run `az login` in your terminal and retry.",
            status_code=401,
            detail="not_logged_in",
        )

    if any(hint in lowered for hint in _AUTHORIZATION_HINTS):
        raise AzureCLIError(
            "Your Azure account is not authorized to perform this action.",
            status_code=403,
            detail="unauthorized",
        )

    if any(hint in lowered for hint in _RG_NOT_FOUND_HINTS):
        raise AzureCLIError(
            "The specified resource group does not exist or is not accessible.",
            status_code=404,
            detail="resource_group_not_found",
        )

    # Generic fallback: surface the CLI's own message.
    clean = " ".join((stderr or "Azure CLI command failed.").split())
    raise AzureCLIError(clean, status_code=400, detail="cli_error")


def _sku_name(resource: Dict[str, Any]) -> Optional[str]:
    """Extract a friendly SKU name, handling both string and object forms."""
    sku = resource.get("sku")
    if sku is None:
        return None
    if isinstance(sku, dict):
        return sku.get("name")
    return str(sku)


def list_resource_groups() -> List[Dict[str, Any]]:
    """Return every Azure resource group as a structured summary."""
    groups = _run_az(["group", "list"]) or []
    return [
        {
            "name": g.get("name"),
            "location": g.get("location"),
            "id": g.get("id"),
            "provisioning_state": g.get("properties", {}).get("provisioningState")
            if isinstance(g.get("properties"), dict)
            else None,
            "tags": g.get("tags") or {},
        }
        for g in groups
    ]


def scan_resource_group(resource_group: str) -> Dict[str, Any]:
    """Fetch and structure every resource inside ``resource_group``.

    Handles a missing group gracefully (``az resource list`` exits non-zero),
    which is converted to a 404 by the caller.
    """
    raw = _run_az(["resource", "list", "--resource-group", resource_group]) or []

    resources: List[Dict[str, Any]] = []
    for r in raw:
        resources.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "location": r.get("location"),
                "sku": _sku_name(r),
                "tags": r.get("tags") or {},
                "resource_group": r.get("resourceGroup"),
                "kind": r.get("kind"),
            }
        )

    return {
        "resource_group": resource_group,
        "resource_count": len(resources),
        "resources": resources,
    }
