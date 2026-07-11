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
import ProgressTracker from "../components/ProgressTracker";

export default function Dashboard() {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Pick an Azure resource group and run an AI cost analysis.
        </p>
      </div>

      <div className="card p-5">
        <label className="label" htmlFor="rg">Resource group</label>
        {loadingGroups ? (
          <p className="text-sm text-slate-500">Loading resource groups…</p>
        ) : groupError ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {groupError}
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-500">No resource groups found in your subscription.</p>
        ) : (
          <select
            id="rg"
            className="input"
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
        )}

        <button
          onClick={handleRun}
          className="btn-primary mt-4"
          disabled={running || !selected || loadingGroups}
        >
          {running ? "Running…" : "Run Analysis"}
        </button>
      </div>

      <ProgressTracker messages={messages} running={running} done={done} error={runError} />
    </div>
  );
}
