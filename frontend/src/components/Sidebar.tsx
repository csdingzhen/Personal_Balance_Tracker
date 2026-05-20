import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Receipt, PiggyBank, TrendingUp, Upload, Link2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const nav = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts',     icon: Wallet,           label: 'Accounts' },
  { to: '/transactions', icon: Receipt,          label: 'Transactions' },
  { to: '/budget',       icon: PiggyBank,        label: 'Budget' },
  { to: '/investments',  icon: TrendingUp,       label: 'Investments' },
  { to: '/import',       icon: Upload,           label: 'Import CSV' },
  { to: '/link',         icon: Link2,            label: 'Link Account' },
];

export default function Sidebar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await api.post('/auth/logout', {}).catch(() => {});
    setUser(null);
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-bg-deep border-r border-border-soft h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border-soft flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'conic-gradient(from 135deg at 60% 40%, oklch(0.86 0.13 200), oklch(0.72 0.12 200) 40%, oklch(0.35 0.06 200) 70%, oklch(0.86 0.13 200))',
          }}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none"
            stroke="oklch(0.125 0.005 60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5 10.5 5 7 7.5 9 12.5 3.5" />
          </svg>
        </div>
        <span className="font-medium text-text text-[15px] tracking-[-0.01em]">NeverBroke</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-text-muted hover:bg-surface hover:text-text-2'
              }`
            }
          >
            <Icon size={15} strokeWidth={1.7} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-border-soft">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
              <span className="text-accent text-[11px] font-semibold uppercase">
                {user?.username?.[0] ?? '?'}
              </span>
            </div>
            <span className="text-text-2 text-sm truncate">{user?.username}</span>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded text-text-dim hover:text-text hover:bg-surface transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
