import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Logo, LogoWordmark } from "../components/Logo";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      saveAuth(res.token, res.email);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="aurora-bg grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/5 p-10 lg:flex">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
        <Link to="/" className="relative">
          <LogoWordmark size={32} />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight text-white">
            Find the spend you’re <span className="gradient-text">leaving on the table</span>.
          </h2>
          <p className="mt-3 max-w-sm text-slate-400">
            Scan Azure, get an AI cost report, and copy the fixes that actually move the bill.
          </p>
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-xl font-bold text-brand">
              $
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">$2.4k / month</p>
              <p className="text-xs text-slate-500">average reclaimed per audit*</p>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} FinOps Cost Detective</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Logo size={28} />
          </div>
          <div className="mb-6 text-center lg:text-left">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-400">Sign in to analyze your Azure costs.</p>
          </div>

          <form onSubmit={handleSubmit} className="glass space-y-4 p-6">
            {error && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            No account?{" "}
            <Link to="/signup" className="font-semibold text-brand hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
