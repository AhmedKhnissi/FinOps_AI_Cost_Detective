import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Analysis, HistoryEntry, Issue, Severity } from "../lib/types";
import type { AnalyzeResponse } from "../lib/api";
import StatCard from "../components/StatCard";
import SeverityDonut from "../components/SeverityDonut";

// ── Display helpers ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "border-danger/40 bg-danger/15 text-danger",
  medium: "border-warn/40 bg-warn/15 text-warn",
  low: "border-ok/40 bg-ok/15 text-ok",
};

type IssueType = "over-provisioned" | "unused" | "misconfigured" | "optimization";

// The backend returns free-text issues without an explicit category, so we
// derive one from the title/description. This keeps both fresh analyses and
// older history entries (which lack a stored type) consistent.
function categorizeIssue(issue: Issue): IssueType {
  const text = `${issue.title} ${issue.description}`.toLowerCase();
  if (/(over-?provision|oversized|too large|larger than|right-?siz|sku|vm size|overpowered|capacity)/.test(text))
    return "over-provisioned";
  if (/(unused|idle|stopped|unattached|orphan|dangling|empty|not in use|zombie|abandoned)/.test(text))
    return "unused";
  if (/(misconfig|mis-config|public(ly)? exposed|no tag|missing tag|lifecycle|exposed|rbac|public ip|encryption)/.test(text))
    return "misconfigured";
  return "optimization";
}

// Best-effort link between an issue and a concrete fix command. We prefer a
// command naming the issue's resource, then fall back to a keyword match.
function matchCommand(issue: Issue, commands: string[]): string | null {
  if (issue.resource) {
    const hit = commands.find((c) => c.includes(issue.resource as string));
    if (hit) return hit;
  }
  const words = issue.title
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  for (const w of words) {
    const hit = commands.find((c) => c.toLowerCase().includes(w));
    if (hit) return hit;
  }
  return null;
}

// ── Small presentational components ──────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`chip capitalize ${SEVERITY_STYLES[severity]}`}>{severity}</span>
  );
}

function TypeBadge({ type }: { type: IssueType }) {
  return (
    <span className="chip border-brand/40 bg-brand/10 text-brand">
      {type.replace("-", " ")}
    </span>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }
  return (
    <div className="relative rounded-xl border border-ink-500 bg-ink-900">
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-lg border border-ink-500 bg-ink-700 px-2 py-1 text-xs text-slate-300 transition hover:bg-ink-600"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-3 pr-16 text-xs leading-relaxed text-ok">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function IssueCard({ issue, commands }: { issue: Issue; commands: string[] }) {
  const type = categorizeIssue(issue);
  const command = matchCommand(issue, commands);
  return (
    <div className="card p-5 transition hover:border-brand/30">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <SeverityBadge severity={issue.severity} />
        <TypeBadge type={type} />
      </div>

      <h4 className="font-semibold text-slate-100">{issue.title}</h4>

      {issue.resource && (
        <p className="mt-1 text-xs text-slate-500">
          Resource: <span className="font-mono text-slate-300">{issue.resource}</span>
        </p>
      )}

      <p className="mt-2 text-sm leading-relaxed text-slate-300">{issue.description}</p>

      {issue.estimated_savings && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ok/30 bg-ok/10 px-2.5 py-1 text-sm font-semibold text-ok">
          Est. savings: {issue.estimated_savings}
        </p>
      )}

      {command && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Suggested fix
          </p>
          <CodeBlock code={command} />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReportView {
  resourceGroup: string;
  resourceCount?: number;
  createdAt?: string;
  analysis: Analysis | null;
  estimatedSavings?: string | null;
}

function IconBox({ children }: { children: ReactNode }) {
  return <span className="grid h-4 w-4 place-items-center">{children}</span>;
}

export default function Report() {
  const location = useLocation();
  const state = location.state as
    | { result?: AnalyzeResponse; entry?: HistoryEntry }
    | null;

  let view: ReportView | null = null;
  if (state?.result) {
    const r = state.result;
    view = {
      resourceGroup: r.resource_group,
      resourceCount: r.resource_count,
      analysis: r.analysis,
    };
  } else if (state?.entry) {
    const e = state.entry;
    view = {
      resourceGroup: e.resource_group,
      resourceCount: e.resources_scanned,
      createdAt: e.created_at,
      analysis: e.analysis_result,
      estimatedSavings: e.estimated_savings,
    };
  }

  if (!view) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-300">No report to display.</p>
        <Link to="/dashboard" className="mt-3 inline-block font-semibold text-brand hover:underline">
          Run a new analysis
        </Link>
      </div>
    );
  }

  const analysis = view.analysis;
  const issues = analysis?.issues ?? [];
  const commands = analysis?.fix_commands ?? [];
  const savings = analysis?.estimated_savings ?? view.estimatedSavings ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analysis Report</h1>
          <p className="text-sm text-slate-400">
            Resource group: <span className="font-mono text-slate-200">{view.resourceGroup}</span>
          </p>
        </div>
        {view.createdAt && (
          <div className="text-right text-sm text-slate-400">
            {new Date(view.createdAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Summary: stats + severity donut */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<IconBox>▣</IconBox>}
            label="Resources scanned"
            value={view.resourceCount ?? 0}
          />
          <StatCard
            icon={<IconBox>⚠</IconBox>}
            label="Issues found"
            value={issues.length}
          />
          <StatCard
            icon={<IconBox>$</IconBox>}
            label="Est. monthly savings"
            value={savings ?? "—"}
            accent
          />
        </div>
        <div className="card flex items-center justify-center p-5">
          <SeverityDonut issues={issues} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-100">Summary</h2>
        <div className="card p-5 text-sm leading-relaxed text-slate-300">
          {analysis?.summary ?? "No summary available."}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-100">
          Issues <span className="text-slate-500">({issues.length})</span>
        </h2>
        {issues.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
            <span className="text-3xl">🎉</span>
            <p>No issues found. Your resource group looks lean.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {issues.map((issue, i) => (
              <IssueCard key={i} issue={issue} commands={commands} />
            ))}
          </div>
        )}
      </section>

      {commands.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">All fix commands</h2>
          <div className="space-y-2">
            {commands.map((cmd, i) => (
              <CodeBlock key={i} code={cmd} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
