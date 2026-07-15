import type { Severity } from "../lib/types";

interface SeverityDonutProps {
  issues: { severity: Severity }[];
  size?: number;
}

const COLORS: Record<Severity, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#34d399",
};

const ORDER: Severity[] = ["high", "medium", "low"];

/**
 * Zero-dependency SVG donut chart of issue severity counts.
 * Renders a thin track plus stacked segments; centers the total.
 */
export default function SeverityDonut({ issues, size = 132 }: SeverityDonutProps) {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.severity] += 1;
  const total = issues.length;

  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = ORDER.map((sev) => {
    const value = counts[sev];
    const fraction = total === 0 ? 0 : value / total;
    const dash = fraction * circumference;
    const seg = {
      sev,
      value,
      dashArray: `${dash} ${circumference - dash}`,
      dashOffset: -offset,
    };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        {total > 0 &&
          segments.map(
            (s) =>
              s.value > 0 && (
                <circle
                  key={s.sev}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={COLORS[s.sev]}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={s.dashArray}
                  strokeDashoffset={s.dashOffset}
                />
              )
          )}
      </svg>

      <div className="space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-slate-100">{total}</span>
          <span className="text-sm text-slate-400">issues</span>
        </div>
        {ORDER.map((sev) => (
          <div key={sev} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[sev] }}
            />
            <span className="capitalize text-slate-400">{sev}</span>
            <span className="font-semibold text-slate-200">{counts[sev]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
