"""PostgreSQL access layer for the AI Cloud Cost Detective (steps ④ / ⑥).

Owns the connection pool, the schema bootstrap, and the handful of queries
the API needs:

  * ``init_db``        — open the pool and create ``users`` / ``analyses``
  * ``get_or_create_user``  — resolve a user by email, creating the row if new
  * ``create_analysis``     — insert a ``pending`` analysis tied to a client id
  * ``finalize_analysis``  — fill in results once scan + AI finish
  * ``get_user_analyses``  — newest-first history for one user

The module degrades gracefully: if ``DATABASE_URL`` is unset (or Postgres is
unreachable at startup) every query becomes a no-op and ``is_available()``
returns ``False``. The rest of the API keeps working without persistence — set
``DATABASE_URL`` in ``.env`` to switch it on. We use ``psycopg2`` (synchronous)
because the scan and AI steps are already blocking; the API runs DB calls in a
threadpool so the event loop is never stalled.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

try:
    import psycopg2
    from psycopg2.extras import Json
    from psycopg2.pool import ThreadedConnectionPool
except ImportError:  # pragma: no cover - dependency guard
    psycopg2 = None  # type: ignore

from dotenv import load_dotenv

# Make sibling imports / .env resolution work from backend/ or repo root.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Module-level pool; ``None`` means persistence is disabled.
_pool: Optional["ThreadedConnectionPool"] = None
DB_AVAILABLE = False

# Used when a request carries no identity header, so the smoke test and ad-hoc
# curl calls still persist history. Real auth (step ①) replaces this with JWT.
DEMO_EMAIL = "demo@example.com"

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_ANALYSES = """
CREATE TABLE IF NOT EXISTS analyses (
    id                TEXT PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    resource_group    TEXT NOT NULL,
    resources_scanned INTEGER NOT NULL DEFAULT 0,
    issues_found      INTEGER NOT NULL DEFAULT 0,
    estimated_savings TEXT,
    analysis_result   JSONB,
    status            TEXT NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_analyses_user_created
    ON analyses (user_id, created_at DESC);
"""


def is_available() -> bool:
    """Whether the PostgreSQL pool is live (read at call time)."""
    return DB_AVAILABLE


def init_db() -> None:
    """Open the pool and bootstrap the schema if a database is configured."""
    global _pool, DB_AVAILABLE
    if psycopg2 is None:
        print("[db] psycopg2 not installed — persistence disabled.")
        return
    url = os.getenv("DATABASE_URL")
    if not url:
        print("[db] DATABASE_URL not set — persistence disabled.")
        return
    try:
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=url)
        # NOTE: a pooled connection is a context manager whose __exit__ calls
        # conn.close() (not putconn), so we must return it explicitly or the
        # pool permanently loses the slot and exhausts under load.
        conn = _pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(CREATE_USERS)
                cur.execute(CREATE_ANALYSES)
                cur.execute(CREATE_INDEX)
            conn.commit()
        finally:
            _pool.putconn(conn)
        DB_AVAILABLE = True
        print("[db] Connected to PostgreSQL; tables ready.")
    except Exception as exc:  # connection refused, bad URL, auth failure, etc.
        print(f"[db] Could not initialise PostgreSQL ({exc}); persistence disabled.")
        _pool = None


def _getconn():
    if _pool is None:
        return None
    try:
        return _pool.getconn()
    except Exception:
        return None


def _putconn(conn) -> None:
    if _pool is not None and conn is not None:
        try:
            _pool.putconn(conn)
        except Exception:
            pass


def get_or_create_user(email: str) -> Optional[int]:
    """Return the user id for ``email``, creating the row on first sight."""
    conn = _getconn()
    if conn is None or not email:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email) VALUES (%s) "
                "ON CONFLICT (email) DO NOTHING;",
                (email,),
            )
            cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"[db] get_or_create_user failed: {exc}")
        return None
    finally:
        _putconn(conn)


def create_analysis(analysis_id: str, user_id: Optional[int], resource_group: str) -> None:
    """Insert a ``pending`` analysis row; no-op if DB is offline or user missing."""
    conn = _getconn()
    if conn is None or user_id is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO analyses (id, user_id, resource_group, status) "
                "VALUES (%s, %s, %s, 'pending') "
                "ON CONFLICT (id) DO UPDATE SET status = 'pending', "
                "resource_group = EXCLUDED.resource_group;",
                (analysis_id, user_id, resource_group),
            )
            conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"[db] create_analysis failed: {exc}")
    finally:
        _putconn(conn)


def finalize_analysis(
    analysis_id: str,
    resources_scanned: int,
    issues_found: int,
    estimated_savings: Optional[str],
    analysis_result: Dict[str, Any],
    status: str = "complete",
) -> None:
    """Persist the completed scan + AI results onto the analysis row."""
    conn = _getconn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE analyses
                   SET resources_scanned = %s,
                       issues_found      = %s,
                       estimated_savings = %s,
                       analysis_result   = %s,
                       status            = %s
                 WHERE id = %s;
                """,
                (
                    resources_scanned,
                    issues_found,
                    estimated_savings,
                    Json(analysis_result),
                    status,
                    analysis_id,
                ),
            )
            conn.commit()
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"[db] finalize_analysis failed: {exc}")
    finally:
        _putconn(conn)


def get_user_analyses(email: str) -> List[Dict[str, Any]]:
    """Return the user's analyses (newest first), or [] if DB is offline."""
    conn = _getconn()
    if conn is None or not email:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id, a.resource_group, a.resources_scanned, a.issues_found,
                       a.estimated_savings, a.analysis_result, a.status, a.created_at
                  FROM analyses a
                  JOIN users u ON u.id = a.user_id
                 WHERE u.email = %s
                 ORDER BY a.created_at DESC;
                """,
                (email,),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as exc:
        print(f"[db] get_user_analyses failed: {exc}")
        return []
    finally:
        _putconn(conn)
