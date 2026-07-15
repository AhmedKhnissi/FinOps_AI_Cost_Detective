interface ProgressTrackerProps {
  messages: string[];
  running: boolean;
  done: boolean;
  error?: string | null;
}

export default function ProgressTracker({ messages, running, done, error }: ProgressTrackerProps) {
  const hasActivity = messages.length > 0 || !!error;

  return (
    <div className="card overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-ink-900/60 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger/70" />
        <span className="h-3 w-3 rounded-full bg-warn/70" />
        <span className="h-3 w-3 rounded-full bg-ok/70" />
        <span className="ml-2 font-mono text-xs text-slate-500">live — analysis progress</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {running && !done ? (
            <>
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-brand">running</span>
            </>
          ) : done ? (
            <>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-ok text-[10px] text-ink-900">
                ✓
              </span>
              <span className="text-ok">done</span>
            </>
          ) : (
            <span className="text-slate-500">idle</span>
          )}
        </span>
      </div>

      <div className="p-4">
        {error && (
          <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {!hasActivity ? (
          <p className="text-sm text-slate-500">
            Select a resource group and run an analysis to see live progress here.
          </p>
        ) : (
          <ol className="space-y-0">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isError = msg.toLowerCase().startsWith("error");
              const active = isLast && running && !done;
              return (
                <li key={i} className="flex items-start gap-3 py-1.5">
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                    {i < messages.length - 1 || done ? (
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isError ? "bg-danger" : "bg-ok"
                        }`}
                      />
                    ) : (
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          active ? "animate-pulse-slow bg-brand" : "bg-ink-500"
                        }`}
                      />
                    )}
                  </span>
                  <span
                    className={`font-mono text-sm leading-relaxed ${
                      isError ? "text-danger" : "text-slate-300"
                    }`}
                  >
                    {msg}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
