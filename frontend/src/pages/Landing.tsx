import { Link } from "react-router-dom";
import { isAuthenticated, getEmail } from "../lib/auth";
import { Logo, LogoWordmark } from "../components/Logo";
import Footer from "../components/Footer";

/* ── inline icon set (stroke = currentColor) ─────────────────────────────── */
const Icon = {
  Scan: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M3 12h18" />
    </svg>
  ),
  Spark: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
  Terminal: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m4 17 6-5-6-5M12 19h8" />
    </svg>
  ),
  Pulse: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  ),
  History: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4M12 8v4l3 2" />
    </svg>
  ),
  Check: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  Arrow: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

const features = [
  {
    icon: Icon.Scan,
    title: "Azure inventory scan",
    body: "Lists every resource in a chosen resource group through the az CLI — no SDK boilerplate.",
  },
  {
    icon: Icon.Spark,
    title: "AI cost analysis",
    body: "An OpenAI-compatible model flags over-provisioning, idle resources, and misconfigurations.",
  },
  {
    icon: Icon.Terminal,
    title: "Runnable fixes",
    body: "Every finding ships with a copy-paste az command you can run to reclaim the spend.",
  },
  {
    icon: Icon.Pulse,
    title: "Live progress",
    body: "A WebSocket streams the analysis run step-by-step, so you see work happen in real time.",
  },
  {
    icon: Icon.History,
    title: "History that tracks",
    body: "Completed analyses persist to PostgreSQL — watch your FinOps wins accumulate over time.",
  },
  {
    icon: Icon.Check,
    title: "Ranked savings",
    body: "Issues are scored by severity with estimated savings, so you fix the costliest first.",
  },
];

const stats = [
  { value: "23%", label: "avg cloud waste caught*" },
  { value: "1-click", label: "ready-to-run az fixes" },
  { value: "Live", label: "streaming progress feed" },
];

const steps = [
  { n: "01", title: "Connect Azure", body: "Point the app at a subscription and pick a resource group." },
  { n: "02", title: "AI analyzes", body: "The model inspects inventory for waste and ranks the findings." },
  { n: "03", title: "Fix & save", body: "Copy the az commands, apply them, and watch the bill drop." },
];

/* ── mock product preview (purely decorative, great for screenshots) ─────── */
function PreviewCard() {
  const segs = [
    { w: 38, c: "#f87171", l: "High" },
    { w: 34, c: "#fbbf24", l: "Medium" },
    { w: 28, c: "#34d399", l: "Low" },
  ];
  return (
    <div className="glass animate-float w-full max-w-md p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-sm font-semibold text-slate-200">Cost Report</span>
        </div>
        <span className="chip border-brand/40 bg-brand/10 text-brand">rg-prod-eu</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { l: "Scanned", v: "142" },
          { l: "Issues", v: "11" },
          { l: "Saved/mo", v: "$2.4k" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/5 bg-ink-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{s.l}</p>
            <p className="mt-1 text-lg font-bold text-slate-100">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-slate-400">Severity breakdown</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {segs.map((s) => (
            <div key={s.l} style={{ width: `${s.w}%`, backgroundColor: s.c }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          {segs.map((s) => (
            <span key={s.l} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.c }} />
              {s.l}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {[
          "Over-provisioned VM · $980/mo",
          "Idle public IP · $35/mo",
          "Unused disk · $120/mo",
        ].map((t) => (
          <div
            key={t}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-900/40 px-3 py-2 text-xs text-slate-300"
          >
            <span className="text-brand">
              <Icon.Check width={14} height={14} />
            </span>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const authed = isAuthenticated();
  const email = getEmail();

  return (
    <div className="aurora-bg min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <LogoWordmark size={30} />
          <nav className="flex items-center gap-2 text-sm">
            {authed ? (
              <Link to="/dashboard" className="btn-primary">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden rounded-lg px-3 py-2 font-medium text-slate-300 hover:text-white sm:block">
                  Sign in
                </Link>
                <Link to="/signup" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2">
        <div className="animate-fade-up">
          <span className="chip border-brand/30 bg-brand/10 text-brand">
            <Icon.Spark width={14} height={14} /> AI-powered FinOps
          </span>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Catch wasted cloud spend before your{" "}
            <span className="gradient-text">invoice</span> does.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-400">
            FinOps AI Cost Detective scans your Azure resource groups, finds
            over-provisioned and idle resources, and hands you ranked savings with
            ready-to-run <code className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-sm text-brand">az</code> fix commands.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={authed ? "/dashboard" : "/signup"} className="btn-primary px-6 py-3 text-base">
              {authed ? "Open dashboard" : "Start free"}
              <Icon.Arrow width={18} height={18} />
            </Link>
            <a href="#how" className="btn-ghost px-6 py-3 text-base">
              See how it works
            </a>
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-bold text-white">{s.value}</dt>
                <dd className="text-xs text-slate-500">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PreviewCard />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Everything you need to cut the bill</h2>
          <p className="mt-2 text-slate-400">From raw inventory to a copy-paste remediation plan.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card group p-5 transition hover:border-brand/40">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand/20">
                <f.icon width={22} height={22} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-100">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">How it works</h2>
          <p className="mt-2 text-slate-400">Three steps from subscription to savings.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="glass p-6">
              <span className="text-sm font-bold text-brand">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-brand/5 p-10 text-center shadow-glow-soft">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
          <h2 className="relative text-2xl font-bold text-white sm:text-3xl">
            Stop overpaying for cloud.
          </h2>
          <p className="relative mx-auto mt-2 max-w-md text-slate-400">
            {email ? `Signed in as ${email}.` : "Connect Azure and see your first savings in minutes."}
          </p>
          <div className="relative mt-6 flex justify-center">
            <Link to={authed ? "/dashboard" : "/signup"} className="btn-primary px-6 py-3 text-base">
              {authed ? "Open dashboard" : "Get started free"}
              <Icon.Arrow width={18} height={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
