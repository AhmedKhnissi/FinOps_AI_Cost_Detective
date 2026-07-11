import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../lib/api";
import { saveAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

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
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to analyze your Azure costs.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        No account?{" "}
        <Link to="/signup" className="font-semibold text-brand hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
