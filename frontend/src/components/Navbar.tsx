import { Link, useNavigate } from "react-router-dom";
import { getEmail, logout } from "../lib/auth";
import { Logo } from "./Logo";

export default function Navbar() {
  const navigate = useNavigate();
  const email = getEmail();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-sm font-bold tracking-tight">
            FinOps <span className="text-brand">Cost Detective</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/dashboard"
            className="rounded-lg px-3 py-2 font-medium text-slate-300 transition hover:bg-ink-700 hover:text-white"
          >
            Dashboard
          </Link>
          <Link to="/history" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-ink-600">
            History
          </Link>
          <span className="mx-2 hidden max-w-[160px] truncate text-slate-500 sm:inline" title={email ?? ""}>
            {email}
          </span>
          <button onClick={handleLogout} className="btn-ghost">
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
