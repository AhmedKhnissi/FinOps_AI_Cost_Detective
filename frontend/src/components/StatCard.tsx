import type { ReactNode } from "react";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  /** Sky glow + emerald value for "savings" style highlights. */
  accent?: boolean;
  hint?: string;
}

/** Compact KPI tile used across Dashboard / Report. */
export default function StatCard({ icon, label, value, accent, hint }: StatCardProps) {
  return (
    <div
      className={`card relative overflow-hidden p-5 ${
        accent ? "border-brand/30 bg-brand/5 shadow-glow-soft" : ""
      }`}
    >
      {accent && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/20 blur-2xl" />
      )}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {icon && <span className={accent ? "text-brand" : "text-slate-400"}>{icon}</span>}
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${
          accent ? "gradient-text" : "text-slate-100"
        }`}
      >
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
