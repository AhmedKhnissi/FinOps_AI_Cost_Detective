import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getResourceGroups,
  openProgressSocket,
  runAnalysis,
  ApiError,
  type AnalyzeResponse,
  type ProgressSocket,
} from "../lib/api";
import type { ResourceGroup } from "../lib/types";
import { getEmail } from "../lib/auth";
import ProgressTracker from "../components/ProgressTracker";
import { Logo } from "../components/Logo";

export default function Dashboard() {
  const navigate = useNavigate();
  const email = getEmail();
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);

  const [messages, setMessages] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    getResourceGroups()
      .then((data) => {
        setGroups(data.resource_groups);
        if (data.resource_groups.length > 0) setSelected(data.resource_groups[0].name);
      })
      .catch((err) => {
        setGroupError(
          err instanceof ApiError
            ? err.message
            : "Could not load resource groups. Is the Azure CLI installed and `az login` done?"
        );
      })
      .finally(() => setLoadingGroups(false));
  }, []);

  async function handleRun() {
    if (!selected) return;
    setMessages([]);
    setRunError(null);
    setDone(false);
    setRunning(true);

    const analysisId = crypto.randomUUID();

    // Open the progress socket FIRST (step ④ ordering: socket before POST).
    let socket: ProgressSocket | null = null;
    try {
      socket = openProgressSocket(analysisId, (msg) => {
        setMessages((prev) => [...prev, msg]);
      });
    } catch {
      setRunError("Could not open the progress connection.");
      setRunning(false);
      return;
    }

    try {
      const result: AnalyzeResponse = await runAnalysis(selected, analysisId);
      setMessages((prev) => [...prev, "Analysis complete"]);
      setDone(true);
      // Carry the full result to the Report page (no per-id GET endpoint yet).
      navigate("/report", { state: { result } });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Analysis failed.";
      setRunError(message);
      setMessages((prev) => [...prev, `Error: ${message}`]);
    } finally {
      setRunning(false);
      socket?.close();
    }
  }

  const firstName = email ? email.split("@")[0] : "there";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-ink-800/70 p-6 shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Welcome back,</p>
            <h1 className="text-2xl font-bold text-white">{firstName}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Pick an Azure resource group and run an AI cost analysis.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-900/50 px-4 py-3">
            <Logo size={28} />
            <div className="text-xs">
              <p className="font-medium text-slate-200">Ready to scan</p>
              <p className="text-slate-500">{groups.length} resource groups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Picker */}
      <div className="card p-6">
        <label className="label" htmlFor="rg">Resource group</label>
        {loadingGroups ? (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            Loading resource groups…
          </div>
        ) : groupError ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {groupError}
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-500">No resource groups found in your subscription.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              id="rg"
              className="input sm:max-w-md"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name}
                  {g.location ? ` — ${g.location}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={handleRun}
              className="btn-primary px-6 py-3 sm:w-auto"
              disabled={running || !selected || loadingGroups}
            >
              {running ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900 border-t-transparent" />
                  Running…
                </>
              ) : (
                <>
                  <Logo size={18} /> Run Analysis
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <ProgressTracker messages={messages} running={running} done={done} error={runError} />
    </div>
  );
}
