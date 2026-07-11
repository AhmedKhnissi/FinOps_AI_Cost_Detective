interface ProgressTrackerProps {
  messages: string[];
  running: boolean;
  done: boolean;
  error?: string | null;
}

export default function ProgressTracker({ messages, running, done, error }: ProgressTrackerProps) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        {running && !done ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : done ? (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-xs text-ink-900">
            ✓
          </span>
        ) : (
          <span className="h-3 w-3 rounded-full bg-ink-500" />
        )}
        <h3 className="text-sm font-semibold text-slate-200">Live status</h3>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {messages.length === 0 && !error ? (
        <p className="text-sm text-slate-500">
          Select a resource group and run an analysis to see live progress here.
        </p>
      ) : (
        <ol className="space-y-2">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isError = msg.toLowerCase().startsWith("error");
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    isError
                      ? "bg-red-400"
                      : isLast && running && !done
                        ? "animate-pulse bg-brand"
                        : "bg-emerald-400"
                  }`}
                />
                <span className={isError ? "text-red-300" : "text-slate-300"}>{msg}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
