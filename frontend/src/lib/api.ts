// Fetch/WebSocket client for the FastAPI backend. Attaches the JWT as a Bearer
// token on every request and redirects to /login on 401 (step ①: the frontend
// bounces unauthenticated users).

import { getToken, logout } from "./auth";
import type {
  Analysis,
  AuthResponse,
  HistoryEntry,
  ResourceGroup,
} from "./types";

// Dev: the FastAPI app listens on :8000 (CORS-whitelisted for :5173).
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // Token missing/invalid/expired — drop it and send the user to login.
    logout();
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
    throw new ApiError(401, "Session expired. Please sign in again.");
  }
  return res;
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await safeDetail(res);
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

async function safeDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

// ── Auth (step ①) ────────────────────────────────────────────────────────────
export function signup(email: string, password: string): Promise<AuthResponse> {
  return postJSON<AuthResponse>("/api/auth/signup", { email, password });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return postJSON<AuthResponse>("/api/auth/login", { email, password });
}

// ── Resource groups (step ②) ─────────────────────────────────────────────────
export function getResourceGroups(): Promise<{ resource_groups: ResourceGroup[]; count: number }> {
  return getJSON("/api/resource-groups");
}

// ── Analyze (steps ③ + ⑤) ────────────────────────────────────────────────────
export interface AnalyzeResponse {
  analysis_id: string;
  resource_group: string;
  resource_count: number;
  resources: unknown[];
  analysis: Analysis;
}

export function runAnalysis(resourceGroup: string, analysisId: string): Promise<AnalyzeResponse> {
  return postJSON<AnalyzeResponse>("/api/analyze", {
    resource_group: resourceGroup,
    analysis_id: analysisId,
  });
}

// ── History (step ⑥) ─────────────────────────────────────────────────────────
export function getHistory(): Promise<{ analyses: HistoryEntry[]; count: number }> {
  return getJSON("/api/history");
}

// ── Live progress (step ④) ───────────────────────────────────────────────────
export interface ProgressSocket {
  close(): void;
}

export function openProgressSocket(
  analysisId: string,
  onMessage: (message: string) => void,
  onError?: (err: Event) => void
): ProgressSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/progress/${analysisId}`);
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (typeof data?.message === "string") onMessage(data.message);
    } catch {
      onMessage(ev.data);
    }
  };
  if (onError) ws.onerror = onError;
  return { close: () => ws.close() };
}

export { API_BASE };
