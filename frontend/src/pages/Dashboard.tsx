import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData, Transaction, InvestmentSummary } from '@shared/types';

const DONUT_COLORS = ['oklch(0.86 0.13 200)','oklch(0.80 0.15 155)','oklch(0.83 0.13 80)','oklch(0.72 0.16 28)','oklch(0.78 0.13 290)','oklch(0.82 0.14 45)'];

function fmtCurrency(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

const RANGES = ['1M', '3M', '6M', '1Y', 'ALL'] as const;
type Range = typeof RANGES[number];

function filterHistory(history: { date: string; value: number }[], range: Range) {
  if (range === 'ALL') return history;
  const n = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : 12;
  return history.slice(-n);
}

// ── Spending Calendar ─────────────────────────────────────────────────────────
function SpendingCalendar({ transactions }: { transactions: Transaction[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

  const dailySpend: Record<number, number> = {};
  for (const tx of transactions) {
    if (tx.amount < 0) {
      const d = new Date(tx.date).getDate();
      dailySpend[d] = (dailySpend[d] ?? 0) + Math.abs(tx.amount);
    }
  }
  const maxSpend = Math.max(1, ...Object.values(dailySpend));
  const today = now.getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="eyebrow text-center pb-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const spend = dailySpend[day] ?? 0;
          const intensity = spend > 0 ? 0.12 + (spend / maxSpend) * 0.7 : 0;
          const isToday = day === today;
          return (
            <div
              key={i}
              className={`rounded aspect-square flex flex-col items-center justify-center relative group cursor-default
                ${isToday ? 'ring-1 ring-accent' : ''}`}
              style={{
                background: spend > 0
                  ? `oklch(0.72 0.16 28 / ${intensity})`
                  : 'oklch(0.195 0.005 60)',
              }}
            >
              <span className={`text-[11px] font-medium ${isToday ? 'text-accent' : 'text-text-muted'}`}>{day}</span>
              {spend > 0 && (
                <span className="text-[9px] text-text-dim num">{fmtCurrency(spend, true)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [investments, setInvestments] = useState<InvestmentSummary | null>(null);
  const [calTxs, setCalTxs] = useState<Transaction[]>([]);
  const [range, setRange] = useState<Range>('6M');
  const [activeSlice, setActiveSlice] = useState<{ name: string; value: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);

    Promise.all([
      api.get<DashboardData>('/dashboard'),
      api.get<InvestmentSummary>('/investments'),
      api.get<{ transactions: Transaction[] }>(`/transactions?startDate=${start}&endDate=${end}&limit=200`),
    ])
      .then(([d, inv, txs]) => {
        setData(d);
        setInvestments(inv);
        setCalTxs(txs.transactions);
      })
      .catch((e) => setError(e.message));
  }, []);

  const chartData = useMemo(() => data ? filterHistory(data.history, range) : [], [data, range]);
  const prevNetWorth = data?.history.length ? data.history[Math.max(0, data.history.length - 2)].value : 0;
  const change = data ? data.netWorth - prevNetWorth : 0;
  const changePct = prevNetWorth > 0 ? (change / prevNetWorth) * 100 : 0;

  const pieData = useMemo(() =>
    investments?.holdings.map(h => ({ name: h.ticker, value: Math.round(h.shares * h.currentPrice) })) ?? [],
  [investments]);

  if (error) return <div className="p-8 text-negative text-sm">{error}</div>;
  if (!data) return (
    <div className="p-8 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  // Cash = checking + savings; Investing = investment accounts
  const cashTotal = data.accountsByInstitution
    .flatMap(g => g.accounts)
    .filter(a => a.type === 'checking' || a.type === 'savings')
    .reduce((s, a) => s + a.balance, 0);
  const investTotal = data.accountsByInstitution
    .flatMap(g => g.accounts)
    .filter(a => a.type === 'investment')
    .reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-7 space-y-5 max-w-[1400px]">

      {/* ── Region 1: Net Worth ──────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="eyebrow mb-2">Net Worth</p>
            <p className="num text-[38px] font-semibold text-text leading-none">
              {fmtCurrency(data.netWorth)}
            </p>
            <div className={`flex items-center gap-1 mt-2 text-sm num ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
              {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {fmtFull(change)} ({Math.abs(changePct).toFixed(1)}%) vs last month
            </div>
          </div>

          {/* Range toggle */}
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`btn text-xs h-[28px] px-3 ${r === range ? 'btn-primary' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.86 0.13 200)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="oklch(0.86 0.13 200)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
              labelStyle={{ color: 'oklch(0.62 0.006 60)' }}
              formatter={(v: number) => [fmtCurrency(v), 'Net Worth']}
            />
            <Area type="monotone" dataKey="value" stroke="oklch(0.86 0.13 200)"
              strokeWidth={1.8} fill="url(#nwGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>

        {/* 4-stat strip */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-border-soft">
          {[
            { label: 'Assets',      value: data.totalAssets,      color: 'text-positive' },
            { label: 'Liabilities', value: -data.totalLiabilities, color: 'text-negative' },
            { label: 'Cash',        value: cashTotal,              color: 'text-text' },
            { label: 'Investing',   value: investTotal,            color: 'text-accent' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="eyebrow mb-1">{label}</p>
              <p className={`num text-xl font-medium ${color}`}>
                {value < 0 ? '-' : ''}{fmtFull(value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Region 2: Calendar + Recent Transactions ─────────────────── */}
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 card p-5">
          <div className="card-head px-0 pt-0 pb-4 mb-4 border-b border-border-soft">
            <p className="text-text font-medium">
              Spending — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <SpendingCalendar transactions={calTxs} />
        </div>

        <div className="col-span-2 card">
          <div className="card-head">
            <p className="text-text font-medium">Recent</p>
          </div>
          <div className="divide-y divide-border-soft">
            {data.recentTransactions.map((t: Transaction) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-text-2 text-sm truncate">{t.merchantName ?? '—'}</p>
                  <p className="eyebrow mt-0.5">{t.category ?? '—'}</p>
                </div>
                <p className={`num text-sm font-medium shrink-0 ml-3 ${t.amount > 0 ? 'text-positive' : 'text-text'}`}>
                  {t.amount > 0 ? '+' : '-'}{fmtFull(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Region 3: Investments ──────────────────────────────────────── */}
      {investments && investments.holdings.length > 0 && (
        <section className="card">
          <div className="card-head">
            <p className="text-text font-medium">Portfolio</p>
            <div className="flex gap-3">
              <span className="num text-sm text-positive">
                {investments.totalGainLoss >= 0 ? '+' : ''}{fmtFull(investments.totalGainLoss)}
              </span>
              <span className="num text-sm text-text-muted">
                {fmtCurrency(investments.totalValue)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-0 divide-x divide-border-soft">
            {/* Donut */}
            <div className="col-span-2 p-5 flex flex-col items-center">
              <div className="relative" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={90}
                      dataKey="value"
                      paddingAngle={2}
                      onMouseEnter={(_, i) => setActiveSlice({ name: pieData[i].name, value: pieData[i].value })}
                      onMouseLeave={() => setActiveSlice(null)}
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                          opacity={activeSlice ? (activeSlice.name === pieData[i].name ? 1 : 0.3) : 1}
                          style={{ cursor: 'default', outline: 'none' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {activeSlice ? (
                    <>
                      <p className="eyebrow">{activeSlice.name}</p>
                      <p className="num text-lg font-semibold text-text mt-0.5">{fmtCurrency(activeSlice.value)}</p>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow">Portfolio</p>
                      <p className="num text-lg font-semibold text-text mt-0.5">{fmtCurrency(investments.totalValue)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Holdings table */}
            <div className="col-span-3">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-text-dim uppercase tracking-[0.1em] font-mono">
                    <th className="text-left px-5 py-3">Ticker</th>
                    <th className="text-right px-5 py-3">Value</th>
                    <th className="text-right px-5 py-3">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {investments.holdings.slice(0, 6).map((h) => {
                    const value = h.shares * h.currentPrice;
                    const gl = value - h.shares * h.costBasis;
                    const glPct = h.costBasis > 0 ? (gl / (h.shares * h.costBasis)) * 100 : 0;
                    const weight = investments.totalValue > 0 ? value / investments.totalValue : 0;
                    return (
                      <tr key={h.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="num font-semibold text-accent text-sm">{h.ticker}</span>
                            <div className="h-1 rounded-full bg-accent" style={{ width: `${weight * 60}px`, opacity: 0.4 }} />
                          </div>
                          <p className="text-text-dim text-[11px] mt-0.5 truncate max-w-[140px]">{h.name}</p>
                        </td>
                        <td className="px-5 py-3 text-right num text-sm text-text">{fmtCurrency(value)}</td>
                        <td className={`px-5 py-3 text-right num text-sm ${gl >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {gl >= 0 ? '+' : ''}{glPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
