import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { useAuth, type AuthUser } from '../context/AuthContext';

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await api.post<AuthUser>('/auth/login', { username, password });
      setUser(user);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'conic-gradient(from 135deg at 60% 40%, oklch(0.86 0.13 200), oklch(0.72 0.12 200) 40%, oklch(0.35 0.06 200) 70%, oklch(0.86 0.13 200))' }}>
            <TrendingUp size={16} color="oklch(0.125 0.005 60)" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-semibold text-text tracking-[-0.02em]">NeverBroke</span>
        </div>

        <div className="card p-7">
          <h1 className="text-lg font-semibold text-text mb-1">Welcome back</h1>
          <p className="text-text-muted text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="bg-negative-soft border border-negative/20 text-negative text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="eyebrow block mb-2">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg-deep border border-border rounded px-3 py-2.5 text-sm text-text placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="your username"
                required
              />
            </div>

            <div>
              <label className="eyebrow block mb-2">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-deep border border-border rounded px-3 py-2.5 text-sm text-text placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center h-10 mt-2 disabled:opacity-60"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-bg-deep border-t-transparent rounded-full animate-spin" />
                : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-text-dim text-sm mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent hover:text-accent-2 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
