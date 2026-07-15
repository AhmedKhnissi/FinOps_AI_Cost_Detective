import { Link } from "react-router-dom";
import { LogoWordmark } from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-900/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <LogoWordmark size={28} />
          <p className="max-w-sm text-sm text-slate-500">
            AI-powered FinOps that finds wasted Azure spend and hands you the fix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
          <Link to="/dashboard" className="transition hover:text-brand">
            Dashboard
          </Link>
          <Link to="/login" className="transition hover:text-brand">
            Sign in
          </Link>
          <Link to="/signup" className="transition hover:text-brand">
            Get started
          </Link>
          <span className="text-slate-600">© {new Date().getFullYear()} FinOps Cost Detective</span>
        </div>
      </div>
    </footer>
  );
}
