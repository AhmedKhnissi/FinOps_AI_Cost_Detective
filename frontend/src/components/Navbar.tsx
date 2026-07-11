import { Link, useNavigate } from "react-router-dom";
import { getEmail, logout } from "../lib/auth";

export default function Navbar() {
  const navigate = useNavigate();
  const email = getEmail();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b border-ink-500 bg-ink-800/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-ink-900 font-bold">
            ₿
          </span>
          <span className="text-sm font-semibold tracking-tight">
            FinOps <span className="text-brand">AI Cost Detective</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-ink-600">
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
