import { useEffect, useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../api/client';
import type { InvestmentSummary, Investment } from '@shared/types';

const COLORS = ['oklch(0.86 0.13 200)','oklch(0.80 0.15 155)','oklch(0.83 0.13 80)','oklch(0.72 0.16 28)','oklch(0.78 0.13 290)','oklch(0.82 0.14 45)','oklch(0.76 0.12 180)','oklch(0.80 0.14 340)'];

const RANGES = ['1M', '3M', '6M', 'YTD', 'ALL'] as const;
type Range = typeof RANGES[number];

function fmtCurrency(n: number, digits = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function filterPerf(history: { date: string; value: number }[], range: Range) {
  if (range === 'ALL') return history;
  const now = new Date();
  let start: Date;
  if (range === '1M') { start = new Date(now); start.setMonth(start.getMonth() - 1); }
  else if (range === '3M') { start = new Date(now); start.setMonth(start.getMonth() - 3); }
  else if (range === '6M') { start = new Date(now); start.setMonth(start.getMonth() - 6); }
  else { start = new Date(now.getFullYear(), 0, 1); } // YTD
  return history.filter(h => new Date(h.date) >= start);
}

export default function Investments() {
  const [data, setData] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlice, setActiveSlice] = useState<{ name: string; ticker: string; value: number } | null>(null);
  const [range, setRange] = useState<Range>('3M');

  useEffect(() => {
    api.get<InvestmentSummary>('/investments')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const pieData = useMemo(() =>
    data?.holdings.map(h => ({
      name: h.name,
      ticker: h.ticker,
      value: Math.round(h.shares * h.currentPrice),
    })) ?? [],
  [data]);

  const chartData = useMemo(() =>
    data ? filterPerf(data.performanceHistory, range) : [],
  [data, range]);

  if (loading) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading portfolio...
    </div>
  );
  if (!data) return null;

  const displaySlice = activeSlice ?? { name: 'Portfolio', ticker: '', value: data.totalValue };

  return (
    <div className="p-7 space-y-5 max-w-[1100px]">
      <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Investments</h1>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Portfolio Value', value: fmtCurrency(data.totalValue), color: 'text-text' },
          { label: 'Total Cost',      value: fmtCurrency(data.totalCostBasis), color: 'text-text-muted' },
          { label: 'Total Gain/Loss', value: (data.totalGainLoss >= 0 ? '+' : '') + fmtCurrency(data.totalGainLoss), color: data.totalGainLoss >= 0 ? 'text-positive' : 'text-negative' },
          { label: 'Return',          value: fmtPct(data.totalGainLossPct), color: data.totalGainLossPct >= 0 ? 'text-positive' : 'text-negative' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card px-4 py-3">
            <p className="eyebrow mb-1">{label}</p>
            <p className={`num text-xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Donut + Performance chart ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-5">
        {/* Donut */}
        <div className="col-span-2 card p-5">
          <p className="eyebrow mb-4">Allocation</p>

          <div className="flex flex-col items-center">
            <div className="relative" style={{ width: 220, height: 220 }}>
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={72} outerRadius={100}
                    dataKey="value"
                    paddingAngle={2}
                    onMouseEnter={(_, i) => setActiveSlice({ name: pieData[i].name, ticker: pieData[i].ticker, value: pieData[i].value })}
                    onMouseLeave={() => setActiveSlice(null)}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                        opacity={activeSlice ? (activeSlice.ticker === entry.ticker ? 1 : 0.25) : 1}
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
                    <p className="num font-semibold text-accent text-sm">{activeSlice.ticker}</p>
                    <p className="num text-lg font-semibold text-text mt-0.5">{fmtCurrency(activeSlice.value, 0)}</p>
                    <p className="text-text-dim text-[10px] mt-0.5">
                      {data.totalValue > 0 ? ((activeSlice.value / data.totalValue) * 100).toFixed(1) : 0}% of portfolio
                    </p>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Portfolio</p>
                    <p className="num text-lg font-semibold text-text mt-0.5">{fmtCurrency(data.totalValue, 0)}</p>
                  </>
                )}
              </div>
            </div>

            {/* Allocation list */}
            <div className="w-full mt-2 space-y-1">
              {pieData.map((entry, i) => {
                const pct = data.totalValue > 0 ? (entry.value / data.totalValue) * 100 : 0;
                const isActive = activeSlice?.ticker === entry.ticker;
                return (
                  <div key={i}
                    onMouseEnter={() => setActiveSlice({ name: entry.name, ticker: entry.ticker, value: entry.value })}
                    onMouseLeave={() => setActiveSlice(null)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors ${isActive ? 'bg-surface-hi' : 'hover:bg-surface-2'}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="num text-xs text-accent font-medium w-12 shrink-0">{entry.ticker}</span>
                    <div className="flex-1 h-1 rounded-full bg-surface-hi">
                      <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="num text-xs text-text-muted w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Performance chart */}
        <div className="col-span-3 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="eyebrow mb-1">Performance</p>
              <div className={`flex items-center gap-1 text-sm ${data.totalGainLossPct >= 0 ? 'text-positive' : 'text-negative'}`}>
                {data.totalGainLossPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span className="num font-medium">{fmtPct(data.totalGainLossPct)}</span>
                <span className="text-text-dim text-xs">total return</span>
              </div>
            </div>
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`btn text-xs h-[26px] px-2.5 ${r === range ? 'btn-primary' : ''}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.86 0.13 200)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.86 0.13 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
                formatter={(v: number) => [fmtCurrency(v), 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke="oklch(0.86 0.13 200)"
                strokeWidth={1.8} fill="url(#invGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Holdings table ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <p className="text-text font-medium">Holdings</p>
          <p className="text-text-muted text-sm">{data.holdings.length} positions</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-text-dim uppercase tracking-[0.1em] font-mono border-b border-border-soft">
              <th className="text-left px-5 py-3">Position</th>
              <th className="text-right px-5 py-3">Shares</th>
              <th className="text-right px-5 py-3">Price</th>
              <th className="text-right px-5 py-3">Value</th>
              <th className="text-right px-5 py-3">Cost</th>
              <th className="text-right px-5 py-3">Gain / Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {data.holdings.map((h: Investment, i) => {
              const value = h.shares * h.currentPrice;
              const cost = h.shares * h.costBasis;
              const gl = value - cost;
              const glPct = cost > 0 ? (gl / cost) * 100 : 0;
              const weight = data.totalValue > 0 ? (value / data.totalValue) * 100 : 0;
              return (
                <tr key={h.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <div>
                        <span className="num font-semibold text-accent text-sm">{h.ticker}</span>
                        <span className="text-text-dim text-xs ml-2">{h.account?.name}</span>
                        <p className="text-text-muted text-xs mt-0.5 truncate max-w-[200px]">{h.name}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 ml-4 h-0.5 rounded-full bg-surface-hi">
                      <div className="h-0.5 rounded-full" style={{ width: `${weight}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right num text-sm text-text-2">{h.shares}</td>
                  <td className="px-5 py-3 text-right num text-sm text-text-2">{fmtCurrency(h.currentPrice)}</td>
                  <td className="px-5 py-3 text-right num text-sm font-medium text-text">{fmtCurrency(value)}</td>
                  <td className="px-5 py-3 text-right num text-sm text-text-muted">{fmtCurrency(cost)}</td>
                  <td className={`px-5 py-3 text-right num text-sm font-medium ${gl >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {gl >= 0 ? '+' : ''}{fmtCurrency(gl, 2)}<br />
                    <span className="text-xs opacity-75">{fmtPct(glPct)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
