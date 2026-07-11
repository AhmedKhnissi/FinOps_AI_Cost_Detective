"""Custom JWT + bcrypt authentication (step ① of the request flow).

Issues and verifies signed JWTs (``PyJWT``) and hashes passwords with
``bcrypt``. The :func:`get_current_user` dependency is what the API mounts on
protected routes: it reads the ``Authorization: Bearer <token>`` header, and
falls back to the legacy ``X-User-Email`` header (or a demo user) only when no
Bearer token is present — so the existing smoke test and ad-hoc curl calls keep
working, while a bad/expired token is rejected with 401.

Password hashing uses the modern ``bcrypt.PasswordHasher`` API (bcrypt 4+).
"""

from __future__ import annotations

import datetime
import os
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException

from db import UserExistsError, get_user_by_email, is_available, register_user

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # one week

# The secret signs every token. It MUST come from .env (JWT_SECRET); if it is
# missing we still boot on an insecure dev default (and warn) so local hacking
# on the frontend does not require editing .env first.
JWT_SECRET = os.getenv("JWT_SECRET") or ""
if not JWT_SECRET:
    JWT_SECRET = "dev-insecure-change-me"
    print("[auth] WARNING: JWT_SECRET not set in .env — using an insecure dev default.")

# ── Password hashing ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Return a bcrypt hash for ``password`` (utf-8, salted)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if ``password`` matches ``password_hash`` (constant-time)."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash or wrong type — treat as "no match".
        return False


# ── JWT issue / verify ─────────────────────────────────────────────────────────
def create_token(email: str) -> str:
    """Issue an HS256 JWT carrying ``email`` as the subject, expiring in a week."""
    now = datetime.datetime.utcnow()
    payload = {
        "sub": email,
        "iat": now,
        "exp": now + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Return the subject email if ``token`` is valid, else ``None``."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


# ── FastAPI dependency ─────────────────────────────────────────────────────────
def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_user_email: Optional[str] = Header(default=None),
) -> str:
    """Resolve the acting user's email from the request.

    Prefers a Bearer JWT. If a Bearer token is present but invalid/expired we
    raise 401 (the frontend then redirects to login). When no Bearer token is
    present at all we fall back to the legacy ``X-User-Email`` header and
    finally a demo user — preserving the non-authenticated smoke-test path.
    """
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            email = decode_token(token)
            if email:
                return email
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return (x_user_email or "").strip() or "demo@example.com"


# ── Persistence helpers (thin wrappers over db.py) ─────────────────────────────
def create_user(email: str, password: str) -> int:
    """Hash ``password`` and register the user; raise 409 if already taken."""
    if not is_available():
        raise RuntimeError("Database unavailable — cannot register user.")
    try:
        return register_user(email.strip().lower(), hash_password(password))
    except UserExistsError as exc:
        raise HTTPException(status_code=409, detail="Email is already registered.") from exc


def authenticate_user(email: str, password: str) -> str:
    """Verify credentials and return a JWT, or raise 401 on failure."""
    user = get_user_by_email(email.strip().lower()) if is_available() else None
    if not user or not verify_password(password, user.get("password_hash")):
        # Same message regardless of which part failed (avoid user enumeration).
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return create_token(user["email"])
