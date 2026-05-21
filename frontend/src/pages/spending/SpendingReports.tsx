import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { api } from '../../api/client';

const CAT_COLORS: Record<string, string> = {
  'Groceries': 'oklch(0.80 0.15 140)', 'Dining': 'oklch(0.82 0.14 35)',
  'Entertainment': 'oklch(0.78 0.13 290)', 'Shopping': 'oklch(0.76 0.12 200)',
  'Transportation': 'oklch(0.82 0.13 50)', 'Housing': 'oklch(0.76 0.12 240)',
  'Health & Fitness': 'oklch(0.80 0.13 175)', 'Utilities': 'oklch(0.76 0.12 220)',
  'Travel': 'oklch(0.78 0.13 210)', 'Healthcare': 'oklch(0.76 0.14 10)',
  'Insurance': 'oklch(0.78 0.12 270)',
};

const CAT_ICONS: Record<string, string> = {
  'Groceries': '🛒', 'Dining': '🍽️', 'Entertainment': '🎬',
  'Shopping': '🛍️', 'Transportation': '🚗', 'Housing': '🏠',
  'Health & Fitness': '💪', 'Utilities': '⚡', 'Income': '💰',
  'Travel': '✈️', 'Healthcare': '💊', 'Insurance': '🛡️',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface ReportsData {
  monthly: { month: string; income: number; expenses: number }[];
  categoryTrends: { category: string; data: { month: string; amount: number }[] }[];
  topMerchants: { name: string; total: number; count: number; category: string | null }[];
  savingsRate: { month: string; rate: number }[];
  last6months: string[];
}

// Savings rate gauge — SVG semi-circle
function SavingsGauge({ rate }: { rate: number }) {
  const clamped = Math.min(100, Math.max(0, rate));
  const pct = clamped / 100;
  const cx = 100, cy = 90, r = 70;
  const startX = cx - r, startY = cy;
  const angle = pct * Math.PI;
  const endX = cx + r * Math.cos(Math.PI - angle);
  const endY = cy - r * Math.sin(Math.PI - angle);
  const large = angle > Math.PI / 2 ? 0 : 0;
  const color = rate < 0 ? 'oklch(0.72 0.16 28)' : rate < 20 ? 'oklch(0.83 0.13 80)' : 'oklch(0.80 0.15 155)';

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[200px] mx-auto">
      <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="oklch(0.26 0.006 60)" strokeWidth="14" strokeLinecap="round" />
      {clamped > 0 && (
        <path d={`M ${startX} ${cy} A ${r} ${r} 0 ${large} 1 ${endX} ${endY}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="oklch(0.965 0.004 80)"
        fontSize="26" fontFamily="Geist Mono" fontWeight="600">
        {rate.toFixed(0)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="oklch(0.46 0.007 60)"
        fontSize="10" fontFamily="Geist Mono" letterSpacing="0.08em">
        SAVINGS RATE
      </text>
    </svg>
  );
}

export default function SpendingReports() {
  const [data, setData] = useState<ReportsData | null>(null);
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    api.get<ReportsData>(`/spending/reports?year=${year}&month=${month}`).then(setData);
  }, [year, month]);

  if (!data) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  const currentSavingsRate = data.savingsRate.length
    ? data.savingsRate[data.savingsRate.length - 1].rate
    : 0;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-7 space-y-5 max-w-[1200px]">

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em] flex-1">Reports</h1>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Month-over-month bar chart */}
      <section className="card p-5">
        <p className="text-text font-medium mb-4">Income vs Spending — Last 12 Months</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.monthly} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
              tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
              formatter={(v: number, name: string) => [fmt(v), name === 'income' ? 'Income' : 'Expenses']}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Geist Mono', color: 'oklch(0.62 0.006 60)' }} />
            <Bar dataKey="income"   name="income"   fill="oklch(0.80 0.15 155)" radius={[3,3,0,0]} maxBarSize={28} />
            <Bar dataKey="expenses" name="expenses" fill="oklch(0.72 0.16 28)"  radius={[3,3,0,0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Category trends + savings rate side by side */}
      <div className="grid grid-cols-3 gap-5">
        <section className="col-span-2 card p-5">
          <p className="text-text font-medium mb-4">Category Trends — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
              <XAxis dataKey="month" type="category" allowDuplicatedCategory={false}
                tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 11 }}
                formatter={(v: number, name: string) => [fmt(v), name]}
              />
              {data.categoryTrends.slice(0, 6).map(({ category, data: catData }) => (
                <Line key={category} data={catData} type="monotone"
                  dataKey="amount" name={category}
                  stroke={CAT_COLORS[category] ?? 'oklch(0.62 0.006 60)'}
                  strokeWidth={1.8} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Savings rate gauge */}
        <section className="card p-5 flex flex-col items-center justify-center">
          <p className="text-text font-medium mb-4 self-start">Savings Rate</p>
          <SavingsGauge rate={currentSavingsRate} />
          <div className="w-full mt-4 space-y-1.5">
            {data.savingsRate.slice(-4).map(({ month: m, rate }) => (
              <div key={m} className="flex items-center justify-between">
                <span className="eyebrow">{m.slice(5)}/{m.slice(0,4)}</span>
                <span className={`num text-xs font-medium ${rate >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {rate.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Top merchants */}
      <section className="card overflow-hidden">
        <div className="card-head">
          <p className="text-text font-medium">Top Merchants by Spend</p>
          <p className="text-text-dim text-xs">Last 12 months</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-text-dim uppercase tracking-[0.1em] font-mono border-b border-border-soft">
              <th className="text-left px-5 py-3">#</th>
              <th className="text-left px-5 py-3">Merchant</th>
              <th className="text-left px-5 py-3">Category</th>
              <th className="text-right px-5 py-3">Transactions</th>
              <th className="text-right px-5 py-3">Total Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {data.topMerchants.map((m, i) => (
              <tr key={m.name} className="hover:bg-surface-2 transition-colors">
                <td className="px-5 py-3 num text-sm text-text-dim">{i + 1}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{CAT_ICONS[m.category ?? ''] ?? '📦'}</span>
                    <span className="text-text-2 text-sm">{m.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-text-muted text-sm">{m.category ?? '—'}</td>
                <td className="px-5 py-3 num text-sm text-text-muted text-right">{m.count}</td>
                <td className="px-5 py-3 num text-sm font-medium text-text text-right">{fmt(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
