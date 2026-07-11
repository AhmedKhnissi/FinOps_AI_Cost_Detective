import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getHistory, ApiError } from "../lib/api";
import type { HistoryEntry } from "../lib/types";

function SavingsPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-500">—</span>;
  return <span className="font-medium text-emerald-300">{value}</span>;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-slate-400">Past analyses for your account.</p>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="card p-8 text-center text-slate-400">
          <p>No analyses yet.</p>
          <Link to="/" className="mt-3 inline-block text-brand hover:underline">
            Run your first analysis
          </Link>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-700 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Resource group</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Issues</th>
                <th className="px-4 py-3 text-right">Est. savings</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600">
              {entries.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => openReport(e)}
                  className="cursor-pointer hover:bg-ink-700/60"
                >
                  <td className="px-4 py-3 font-mono text-slate-200">{e.resource_group}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{e.issues_found}</td>
                  <td className="px-4 py-3 text-right">
                    <SavingsPill value={e.estimated_savings} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-brand">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
