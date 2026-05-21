import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { ChevronRight, Clock } from 'lucide-react';
import { api } from '../../api/client';

const CAT_ICONS: Record<string, string> = {
  'Groceries': '🛒', 'Dining': '🍽️', 'Entertainment': '🎬',
  'Shopping': '🛍️', 'Transportation': '🚗', 'Housing': '🏠',
  'Health & Fitness': '💪', 'Utilities': '⚡', 'Income': '💰',
  'Travel': '✈️', 'Healthcare': '💊', 'Insurance': '🛡️',
  'Transfer': '↔️', 'Other': '📦',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

interface OverviewData {
  totalSpend: number;
  month: string;
  currentMonth: { day: number; amount: number | null }[];
  prevMonth: { day: number; amount: number | null }[];
  todayDay: number;
  recentTransactions: {
    id: string; merchantName: string | null; date: string;
    amount: number; category: string | null; pending: boolean; accountName: string;
  }[];
}

// Merge current + previous month into a single chart dataset
function buildChartData(
  cur: { day: number; amount: number | null }[],
  prev: { day: number; amount: number | null }[],
  days = 31,
) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    current: cur[i]?.amount ?? null,
    prev: prev[i]?.amount ?? null,
  }));
}

export default function SpendingOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<OverviewData>('/spending/overview').then(setData);
  }, []);

  if (!data) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  const chartData = buildChartData(data.currentMonth, data.prevMonth);
  const today = data.todayDay;
  const todayValue = data.currentMonth[today - 1]?.amount ?? null;

  return (
    <div className="p-7 space-y-5 max-w-[1200px]">

      {/* ── Spend This Month card ───────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="eyebrow mb-2">Spend This Month · {data.month}</p>
            <p className="num text-[44px] font-semibold text-text leading-none">
              {fmt(data.totalSpend)}
            </p>
          </div>
          <span className="text-text-dim text-xs bg-surface-hi px-3 py-1.5 rounded-full border border-border-soft">
            vs previous month
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="oklch(0.86 0.13 200)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.86 0.13 200)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
            <XAxis dataKey="day"
              tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v % 5 === 0 || v === 1 ? String(v) : ''}
            />
            <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
              formatter={(v: number, name: string) => [fmtFull(v), name === 'current' ? 'This Month' : 'Last Month']}
              labelFormatter={(l: number) => `Day ${l}`}
            />
            {/* Previous month — dashed */}
            <Area type="monotone" dataKey="prev" stroke="oklch(0.46 0.007 60)"
              strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false}
              connectNulls={false} />
            {/* Current month — solid with fill */}
            <Area type="monotone" dataKey="current" stroke="oklch(0.86 0.13 200)"
              strokeWidth={2} fill="url(#curGrad)" dot={false} connectNulls={false} />
            {/* Today dot */}
            {todayValue !== null && (
              <ReferenceDot x={today} y={todayValue} r={5}
                fill="oklch(0.86 0.13 200)" stroke="oklch(0.155 0.006 60)" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 rounded" style={{ background: 'oklch(0.86 0.13 200)' }} />
            <span className="text-text-dim text-xs">This month</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: 'oklch(0.46 0.007 60)' }} />
            <span className="text-text-dim text-xs">Last month</span>
          </div>
        </div>
      </section>

      {/* ── Two cards: Recent + Upcoming ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Latest Transactions */}
        <div className="card overflow-hidden">
          <div className="card-head">
            <p className="text-text font-medium text-sm">Latest Transactions</p>
            <button onClick={() => navigate('/spending/transactions')}
              className="flex items-center gap-1 text-accent text-xs hover:text-accent-2 transition-colors">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-border-soft">
            {data.recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-surface-hi flex items-center justify-center text-sm shrink-0">
                  {CAT_ICONS[tx.category ?? ''] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-2 text-sm truncate">{tx.merchantName ?? '—'}</p>
                  <p className="eyebrow mt-0.5">
                    {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}{tx.accountName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tx.pending && (
                    <span className="text-[9px] bg-warn-soft text-warn px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider flex items-center gap-1">
                      <Clock size={9} /> Pending
                    </span>
                  )}
                  <p className={`num text-sm font-medium ${tx.amount > 0 ? 'text-positive' : 'text-text'}`}>
                    {tx.amount > 0 ? '+' : '-'}{fmtFull(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Recurring */}
        <UpcomingCard />
      </div>
    </div>
  );
}

// ── Upcoming recurring payments mini-card ─────────────────────────────────────
function UpcomingCard() {
  const [items, setItems] = useState<{
    merchantName: string; amount: number; nextDate: string;
    category: string | null; isExpense: boolean;
  }[]>([]);

  useEffect(() => {
    api.get<{ expenses: typeof items; income: typeof items }>('/spending/recurring')
      .then(d => {
        const all = [...d.expenses, ...d.income];
        const now = new Date();
        const upcoming = all
          .filter(r => new Date(r.nextDate) >= now)
          .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
          .slice(0, 6);
        setItems(upcoming);
      });
  }, []);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

  // Days with upcoming payments
  const upcomingDays = new Set(items.map(i => new Date(i.nextDate).getDate()));
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <p className="text-text font-medium text-sm">Upcoming</p>
      </div>

      {/* Mini calendar */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-7 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="eyebrow text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const hasEvent = upcomingDays.has(day);
            const isToday = day === now.getDate();
            return (
              <div key={i} className={`aspect-square flex flex-col items-center justify-center rounded text-[11px] relative
                ${isToday ? 'bg-accent text-bg-deep font-semibold' : hasEvent ? 'bg-surface-hi' : ''}`}>
                {day}
                {hasEvent && !isToday && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-negative" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="divide-y divide-border-soft border-t border-border-soft">
        {items.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-2.5">
            <span className="text-sm">{CAT_ICONS[item.category ?? ''] ?? '📦'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-text-2 text-sm truncate">{item.merchantName}</p>
              <p className="eyebrow mt-0.5">
                {new Date(item.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <p className={`num text-sm font-medium shrink-0 ${item.isExpense ? 'text-negative' : 'text-positive'}`}>
              {item.isExpense ? '-' : '+'}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)}
            </p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-text-dim text-sm text-center py-6">No upcoming recurring payments detected.</p>
        )}
      </div>
    </div>
  );
}
