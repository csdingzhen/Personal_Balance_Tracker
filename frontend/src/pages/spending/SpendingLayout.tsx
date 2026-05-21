import { NavLink, Outlet, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/spending',              label: 'Overview',     exact: true },
  { to: '/spending/breakdown',    label: 'Breakdown'            },
  { to: '/spending/transactions', label: 'Transactions'         },
  { to: '/spending/recurring',    label: 'Recurring'            },
  { to: '/spending/reports',      label: 'Reports'              },
];

export default function SpendingLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-20 bg-bg border-b border-border-soft">
        <div className="px-7 flex items-center gap-0">
          {TABS.map(({ to, label, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-muted hover:text-text-2'
                }`}
              >
                {label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
