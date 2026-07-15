import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getHistory, ApiError } from "../lib/api";
import type { HistoryEntry } from "../lib/types";

function SavingsPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-ok/30 bg-ok/10 px-2 py-0.5 font-semibold text-ok">
      {value}
    </span>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHistory()
      .then((data) => setEntries(data.analyses))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load history.")
      )
      .finally(() => setLoading(false));
  }, []);

  function openReport(entry: HistoryEntry) {
    navigate("/report", { state: { entry } });
  }

  const totalSaved = entries.reduce((sum, e) => {
    const n = parseFloat((e.estimated_savings ?? "").replace(/[^0-9.]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-sm text-slate-400">Past analyses for your account.</p>
        </div>
        {entries.length > 0 && (
          <div className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-2 text-sm shadow-glow-soft">
            <span className="text-slate-400">Total identified savings: </span>
            <span className="font-bold gradient-text">${totalSaved.toFixed(2)}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Loading…
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-10 text-center text-slate-400">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">📊</span>
          <p>No analyses yet.</p>
          <Link to="/dashboard" className="font-semibold text-brand hover:underline">
            Run your first analysis
          </Link>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Resource group</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Issues</th>
                  <th className="px-4 py-3 text-right">Est. savings</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => openReport(e)}
                    className="cursor-pointer transition hover:bg-ink-700/40"
                  >
                    <td className="px-4 py-3.5 font-mono text-slate-200">{e.resource_group}</td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="rounded-lg bg-ink-700 px-2 py-0.5 text-slate-300">
                        {e.issues_found}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <SavingsPill value={e.estimated_savings} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-semibold text-brand">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
