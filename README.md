# FinOps AI Cost Detective

An AI-powered FinOps web app that scans your **Azure** resource groups, finds
cost waste (over-provisioned, idle, and misconfigured resources), and hands you
back ranked savings opportunities plus **ready-to-run `az` fix commands**.

Pick a resource group → the backend pulls its inventory through the Azure CLI →
an LLM analyzes it for cost problems → a live progress feed streams the run → a
final report shows issues, estimated savings, and remediation commands. Past
analyses are stored in PostgreSQL so you can track your FinOps history.

---

## Features

- **Azure inventory scan** — lists every resource in a chosen resource group via
  the `az` CLI (no SDK boilerplate).
- **AI cost analysis** — an OpenAI-compatible chat model flags over-provisioning,
  idle/unused resources, misconfigurations, wrong pricing tiers, and other
  optimization opportunities.
- **Runnable fixes** — the model returns copy-paste `az …` commands to remediate
  each finding.
- **Live progress** — a WebSocket streams the analysis run step-by-step in the UI.
- **Auth** — custom JWT auth with bcrypt-hashed passwords (`/signup`, `/login`).
- **History** — completed analyses are persisted to Azure PostgreSQL and shown in
  a history view, newest first.

---

## Architecture

```
                              ┌──────────────┐
                              │     USER     │
                              └──────┬───────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │  REACT FRONTEND   │
                           └────────┬──────────┘
                                    :  Login / Signup
                                    ▼
                           ┌───────────────────┐
                           │  PYTHON BACKEND   │
                           │    (FastAPI)      │
                           │  · Custom JWT Auth│
                           └───┬───────┬───┬───┘
                ┌──────────────┘       :   └──────────────┐
                ▼                      ▼                  ▼
         ┌─────────────┐     ┌──────────────┐    ┌──────────────┐
         │  AZURE CLI  │     │   FASTAPI     │    │   OPENAI     │
         │ az resource │     │  WEBSOCKET    │    │  COMPAT API  │
         │ list --rg   │     │  (Progress)   │    │ (Cost Anal.) │
         └──────┬──────┘     └──────┬───────┘    └──────┬───────┘
                ▼                   ▼  Live updates      ▼
         ┌─────────────┐   ┌───────────────┐            :
         │   AZURE     │   │    REACT      │            :
         │ (Resource   │   │  (Progress    │            :
         │   Group)    │   │   Tracker)    │            :
         └─────────────┘   └───────────────┘            ▼
                                                 ┌──────────────┐
                                                 │    AZURE     │
                                                 │  POSTGRESQL  │
                                                 │  (Managed)   │
                                                 │ · users      │
                                                 │ · analyses   │
                                                 └──────┬───────┘
                                                        : Stored results
                                                        ▼
                                                 ┌───────────────┐
                                                 │    REACT      │
                                                 │ (Final Report │
                                                 │  + Suggestions│
                                                 │  + Fixes)     │
                                                 └───────────────┘
```

See [`Architecture.MD`](Architecture.MD) and [`RequestFlow.MD`](RequestFlow.MD)
for the detailed component and request-flow diagrams.

### Request flow

1. User → React → FastAPI auth → JWT (stored in Azure PostgreSQL).
2. User selects a resource group → React → Python backend.
3. Python → Azure CLI → fetches all resources in the group.
4. Python → FastAPI WebSocket → React (live progress).
5. Python → AI provider API → cost analysis.
6. Python → Azure PostgreSQL → stores analysis history.
7. React ← final report with suggestions & fixes.

---

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 18 + TypeScript, Vite, React Router, Tailwind CSS |
| Backend    | Python, FastAPI, Uvicorn |
| Auth       | PyJWT (HS256), bcrypt |
| Scanning   | Azure CLI (`az`) via subprocess |
| AI         | OpenAI-compatible API (OpenRouter, `meta-llama/llama-3.1-8b-instruct`) |
| Database   | Azure Database for PostgreSQL (Flexible Server), `psycopg2` |
| Live feed  | FastAPI / Starlette WebSocket |

---

## Project Structure

```
FinOps_AI_Cost_Detective/
├── Architecture.MD          # Component architecture diagram
├── RequestFlow.MD           # End-to-end request flow diagram
├── backend/
│   ├── main.py              # FastAPI app: HTTP + WebSocket surface, CORS, routing
│   ├── auth.py              # JWT issue/verify + bcrypt password hashing
│   ├── azure_scanner.py     # Azure CLI integration (resource-group scan)
│   ├── ai_analyzer.py       # LLM cost analysis (OpenAI-compatible)
│   ├── db.py                # PostgreSQL access layer (users + analyses)
│   ├── test_api.py          # Backend smoke tests
│   ├── requirements.txt
│   ├── .env.example         # Environment template
│   └── .env                 # Local secrets (git-ignored)
└── frontend/
    ├── src/
    │   ├── App.tsx          # Routes + auth guards
    │   ├── pages/           # Login, Signup, Dashboard, Report, History
    │   ├── components/      # Navbar, ProgressTracker
    │   └── lib/             # api.ts, auth.ts, types.ts
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

---

## Prerequisites

- **Python 3.10+** and **Node.js 18+**
- **[Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)** installed and on your `PATH`, with an active `az login`
- An **OpenAI-compatible API key** (the project uses OpenRouter)
- *(Optional)* An **Azure PostgreSQL** connection string for history persistence

---

## Setup

### 1. Backend

```bash
cd backend

# Create a virtual environment (optional but recommended)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Configure environment
cp .env.example .env
# then edit .env and fill in your values (see Configuration below)
```

### 2. Frontend

```bash
cd frontend
npm install
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env` and set:

| Variable            | Purpose |
|---------------------|---------|
| `BEDROCK_API_KEY`   | AI provider key. Despite the name, the project uses an **OpenRouter** `sk-or-v1-…` key (OpenAI-compatible). `OPENROUTER_API_KEY` / `OPENAI_API_KEY` are also accepted. |
| `JWT_SECRET`        | Long random string used to sign/verify JWTs. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Falls back to an insecure dev default if unset. |
| `DATABASE_URL`      | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db?sslmode=require`). If unset, the app runs **without persistence** and history is disabled. |
| `OPENROUTER_BASE_URL` | *(Optional)* Override the AI base URL (default `https://openrouter.ai/api/v1`). |
| `AI_MODEL`          | *(Optional)* Override the model (default `meta-llama/llama-3.1-8b-instruct`). |

> **Note on naming:** the original spec referenced "Bedrock", but the supplied
> key is an OpenRouter key — AWS Bedrock authenticates with SigV4 access/secret
> keys, not a bearer `sk-` token. OpenRouter is OpenAI-compatible, so the backend
> drives it through the `openai` SDK. See the docstring in
> [`backend/ai_analyzer.py`](backend/ai_analyzer.py) for details.

> **Security:** `backend/.env` is git-ignored, but if it was ever committed,
> rotate any secrets in it (especially the PostgreSQL password) before sharing
> the repo.

---

## Running the App

Start the backend (listens on `http://localhost:8000`):

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Start the frontend dev server (listens on `http://localhost:5173`):

```bash
cd frontend
npm run dev
```

Open <http://localhost:5173>, sign up / log in, pick a resource group, and run
an analysis. The frontend is CORS-whitelisted for `localhost:5173` in
[`backend/main.py`](backend/main.py).

To build the frontend for production:

```bash
cd frontend
npm run build      # type-checks then builds to dist/
```

---

## API Reference

| Method | Path                      | Auth | Description |
|--------|---------------------------|------|-------------|
| GET    | `/`                       | –    | Health check (reports DB status). |
| POST   | `/api/auth/signup`        | –    | Register a user, returns a JWT. |
| POST   | `/api/auth/login`         | –    | Authenticate, returns a JWT. |
| GET    | `/api/resource-groups`    | JWT  | List Azure resource groups. |
| POST   | `/api/analyze`            | JWT  | Scan a resource group, run AI analysis, persist, return the report. |
| GET    | `/api/history`            | JWT  | List the user's past analyses (newest first). |
| WS     | `/ws/progress/{id}`       | –    | Live progress stream for an analysis run. |

Interactive docs are available at `http://localhost:8000/docs` (Swagger UI) when
the backend is running.

---

## Testing

The backend includes smoke tests (covering auth, resource-group listing, and the
PostgreSQL-backed flow):

```bash
cd backend
python -m pytest test_api.py            # if pytest is available
# or
python test_api.py
```

---



