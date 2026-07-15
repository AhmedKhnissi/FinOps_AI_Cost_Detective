import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, ApiError } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { Logo, LogoWordmark } from "../components/Logo";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await signup(email, password);
      saveAuth(res.token, res.email);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account. Try again.");
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
            Your cloud bill has <span className="gradient-text">secrets</span>. Let’s read them.
          </h2>
          <p className="mt-3 max-w-sm text-slate-400">
            Create an account, connect Azure, and turn waste into savings in a single scan.
          </p>
          <div className="mt-8 space-y-2">
            {["AI-ranked cost findings", "Copy-paste az fix commands", "Live progress streaming"].map(
              (t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand/15 text-brand">
                    ✓
                  </span>
                  {t}
                </div>
              )
            )}
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
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-slate-400">Start detecting wasted Azure spend.</p>
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
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-slate-500">Minimum 6 characters.</p>
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
