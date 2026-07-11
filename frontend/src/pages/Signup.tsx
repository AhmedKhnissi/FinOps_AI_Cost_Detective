import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, ApiError } from "../lib/api";
import { saveAuth } from "../lib/auth";

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
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-400">Start detecting wasted Azure spend.</p>
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
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-500">Minimum 6 characters.</p>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
