import { useEffect, useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData, Transaction, InvestmentSummary } from '@shared/types';


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

/** Format x-axis tick depending on data granularity. */
function fmtTick(date: string, range: Range): string {
  if (range === '1M') {
    // date is YYYY-MM-DD — show "May 3" style
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (range === '3M' || range === '6M') {
    // date is YYYY-MM-DD — show "May 12" abbreviated
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // date is YYYY-MM — show "Jan 26"
  return date.slice(5); // MM
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
  const [tab, setTab] = useState<'overview' | 'networth'>('overview');
  const [range, setRange] = useState<Range>('1M');
  const [nwView, setNwView] = useState<'all' | 'assets' | 'liabilities'>('all');
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState('');

  // Load dashboard + investments + calendar transactions once
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

  // Reload chart whenever range or view changes
  useEffect(() => {
    setChartLoading(true);
    const view = tab === 'networth' ? nwView : 'all';
    api.get<{ date: string; value: number }[]>(`/dashboard/history?range=${range}&view=${view}`)
      .then(setChartData)
      .finally(() => setChartLoading(false));
  }, [range, nwView, tab]);

  const prevNetWorth = chartData.length >= 2 ? chartData[chartData.length - 2].value : 0;
  const change = data ? data.netWorth - prevNetWorth : 0;
  const changePct = prevNetWorth > 0 ? (change / prevNetWorth) * 100 : 0;


  if (error) return <div className="p-8 text-negative text-sm">{error}</div>;
  if (!data) return (
    <div className="p-8 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  // ── Derived values used in both tabs ──────────────────────────────────────
  const allAccounts = data.accountsByInstitution.flatMap(g => g.accounts);
  const cashTotal   = allAccounts.filter(a => a.type === 'checking' || a.type === 'savings').reduce((s, a) => s + a.balance, 0);
  const investTotal = allAccounts.filter(a => a.type === 'investment').reduce((s, a) => s + a.balance, 0);
  const debtTotal   = allAccounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const grossTotal  = cashTotal + investTotal + debtTotal;

  // Values & colors for the chart depending on active view
  const chartMeta = {
    all:         { label: 'Net Worth',   value: data.netWorth,          color: 'oklch(0.86 0.13 200)', grad: 'nwGradOv' },
    assets:      { label: 'Total Assets', value: data.totalAssets,      color: 'oklch(0.80 0.15 155)', grad: 'nwGradAs' },
    liabilities: { label: 'Liabilities', value: data.totalLiabilities,  color: 'oklch(0.72 0.16 28)',  grad: 'nwGradLi' },
  };
  const activeView = tab === 'networth' ? nwView : 'all';
  const cm = chartMeta[activeView];

  return (
    <div className="p-7 space-y-5 max-w-[1400px]">

      {/* ── Tab navigation ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-surface border border-border-soft rounded-lg p-1 self-start w-fit">
        {(['overview', 'networth'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm font-medium px-4 py-1.5 rounded transition-colors ${
              tab === t ? 'bg-surface-hi text-text' : 'text-text-muted hover:text-text'
            }`}>
            {t === 'overview' ? 'Overview' : 'Net Worth'}
          </button>
        ))}
      </div>

      {/* ── Net Worth chart card — shared by both tabs ────────────────── */}
      <section className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="eyebrow mb-2">{cm.label}</p>
            <p className="num text-[38px] font-semibold text-text leading-none">
              {fmtCurrency(Math.abs(cm.value))}
            </p>
            <div className={`flex items-center gap-1 mt-2 text-sm num ${change >= 0 ? 'text-positive' : 'text-negative'}`}>
              {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {fmtFull(Math.abs(change))} ({Math.abs(changePct).toFixed(1)}%) vs last period
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* View toggle — only on Net Worth tab */}
            {tab === 'networth' && (
              <div className="flex gap-1">
                {(['all', 'assets', 'liabilities'] as const).map(v => (
                  <button key={v} onClick={() => setNwView(v)}
                    className={`btn text-xs h-[26px] px-3 capitalize ${nwView === v ? 'btn-primary' : ''}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`btn text-xs h-[28px] px-3 ${r === range ? 'btn-primary' : ''}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`transition-opacity duration-150 ${chartLoading ? 'opacity-40' : 'opacity-100'}`}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={cm.grad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cm.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={cm.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
              <XAxis dataKey="date"
                tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtTick(v, range)}
                interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
                labelStyle={{ color: 'oklch(0.62 0.006 60)' }}
                formatter={(v: number) => [fmtCurrency(v), cm.label]}
              />
              <Area type="monotone" dataKey="value" stroke={cm.color}
                strokeWidth={1.8} fill={`url(#${cm.grad})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

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

      {/* ── Overview tab: spending calendar + portfolio ────────────────── */}
      {tab === 'overview' && (
        <>
          <section className="card overflow-hidden">
            <div className="grid grid-cols-5 divide-x divide-border-soft">
              <div className="col-span-3 p-5">
                <p className="text-text font-medium text-sm mb-3">
                  Spending — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <SpendingCalendar transactions={calTxs} />
              </div>
              <div className="col-span-2 flex flex-col">
                <div className="px-5 py-4 border-b border-border-soft">
                  <p className="text-text font-medium text-sm">Recent</p>
                </div>
                <div className="divide-y divide-border-soft overflow-y-auto">
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
          </section>

          {investments && investments.holdings.length > 0 && (
            <section className="card overflow-hidden">
              <div className="card-head">
                <div className="flex items-center gap-3">
                  <p className="text-text font-medium">Portfolio</p>
                  <span className={`num text-sm font-medium ${investments.totalGainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {investments.totalGainLoss >= 0 ? '+' : ''}{fmtFull(investments.totalGainLoss)}
                    {' '}({investments.totalGainLossPct >= 0 ? '+' : ''}{investments.totalGainLossPct.toFixed(1)}%)
                  </span>
                </div>
                <span className="num text-sm text-text-muted">{fmtCurrency(investments.totalValue)}</span>
              </div>
              <div className="grid grid-cols-5 divide-x divide-border-soft">
                <div className="col-span-3 p-5">
                  <p className="eyebrow mb-3">30-Day Performance</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={investments.performanceHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="oklch(0.80 0.15 155)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="oklch(0.80 0.15 155)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.235 0.006 60)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                        tickLine={false} axisLine={false}
                        tickFormatter={(v: string) => new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        interval="preserveStartEnd" />
                      <YAxis tick={{ fill: 'oklch(0.46 0.007 60)', fontSize: 10, fontFamily: 'Geist Mono' }}
                        tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: 'oklch(0.195 0.005 60)', border: '1px solid oklch(0.235 0.006 60)', borderRadius: 10, fontFamily: 'Geist Mono', fontSize: 12 }}
                        formatter={(v: number) => [fmtCurrency(v), 'Value']} />
                      <Area type="monotone" dataKey="value" stroke="oklch(0.80 0.15 155)" strokeWidth={1.8} fill="url(#perfGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="col-span-2">
                  <div className="px-5 py-3 border-b border-border-soft"><p className="eyebrow">Top Holdings</p></div>
                  <div className="divide-y divide-border-soft">
                    {investments.holdings.slice().sort((a, b) => b.shares * b.currentPrice - a.shares * a.currentPrice).slice(0, 5).map(h => {
                      const value = h.shares * h.currentPrice;
                      const gl = value - h.shares * h.costBasis;
                      const glPct = h.costBasis > 0 ? (gl / (h.shares * h.costBasis)) * 100 : 0;
                      return (
                        <div key={h.id} className="flex items-center justify-between px-5 py-3">
                          <div className="min-w-0">
                            <span className="num text-sm font-semibold text-accent">{h.ticker}</span>
                            <p className="text-text-dim text-[11px] mt-0.5 truncate max-w-[120px]">{h.name}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="num text-sm text-text">{fmtCurrency(value)}</p>
                            <p className={`num text-xs ${glPct >= 0 ? 'text-positive' : 'text-negative'}`}>{glPct >= 0 ? '+' : ''}{glPct.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Net Worth tab: accounts + asset breakdown ──────────────────── */}
      {tab === 'networth' && (
        <div className="grid grid-cols-3 gap-5">

          {/* Account overview — left 2 cols */}
          <div className="col-span-2 space-y-4">
            {data.accountsByInstitution.map(({ institution, accounts }) => {
              const filtered = accounts.filter(a =>
                nwView === 'all' ? true :
                nwView === 'assets' ? a.balance > 0 :
                a.balance < 0
              );
              if (filtered.length === 0) return null;
              return (
                <div key={institution.id} className="card overflow-hidden">
                  <div className="card-head">
                    <div className="flex items-center gap-3">
                      {institution.logo ? (
                        <img src={institution.logo} alt={institution.name} className="w-7 h-7 rounded-full"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-surface-hi flex items-center justify-center">
                          <Building2 size={13} className="text-text-dim" />
                        </div>
                      )}
                      <p className="text-text font-medium text-sm">{institution.name}</p>
                    </div>
                    <p className={`num text-sm font-medium ${filtered.reduce((s, a) => s + a.balance, 0) < 0 ? 'text-negative' : 'text-text'}`}>
                      {fmtFull(filtered.reduce((s, a) => s + a.balance, 0))}
                    </p>
                  </div>
                  {filtered.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-border-soft last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                          background: a.type === 'checking' ? 'oklch(0.76 0.12 220)'
                            : a.type === 'savings' ? 'oklch(0.80 0.15 155)'
                            : a.type === 'credit' ? 'oklch(0.72 0.16 28)'
                            : 'oklch(0.86 0.13 200)',
                        }} />
                        <p className="text-text-2 text-sm">{a.name}</p>
                        <p className="eyebrow">{a.type}</p>
                      </div>
                      <p className={`num text-sm font-medium ${a.balance < 0 ? 'text-negative' : 'text-text'}`}>
                        {a.balance < 0 ? '-' : ''}{fmtFull(a.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Asset breakdown — right 1 col */}
          <div className="card p-5 h-fit">
            <p className="text-text font-medium text-sm mb-5">Asset Breakdown</p>

            {/* Stacked bar */}
            {grossTotal > 0 && (
              <div className="w-full h-2.5 rounded-full overflow-hidden flex gap-px mb-5">
                {cashTotal > 0  && <div className="h-full" style={{ width: `${(cashTotal / grossTotal) * 100}%`, background: 'oklch(0.80 0.15 155)' }} />}
                {investTotal > 0 && <div className="h-full" style={{ width: `${(investTotal / grossTotal) * 100}%`, background: 'oklch(0.86 0.13 200)' }} />}
                {debtTotal > 0  && <div className="h-full" style={{ width: `${(debtTotal / grossTotal) * 100}%`, background: 'oklch(0.72 0.16 28)' }} />}
              </div>
            )}

            {/* Breakdown list */}
            <div className="space-y-3">
              {[
                { label: 'Cash',        amount: cashTotal,   color: 'oklch(0.80 0.15 155)' },
                { label: 'Investing',   amount: investTotal, color: 'oklch(0.86 0.13 200)' },
                { label: 'Liabilities', amount: debtTotal,   color: 'oklch(0.72 0.16 28)' },
              ].map(({ label, amount, color }) => {
                const pct = grossTotal > 0 ? (amount / grossTotal) * 100 : 0;
                return (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-text-2 text-sm">{label}</span>
                    </div>
                    <div className="text-right">
                      <span className="num text-sm text-text">{fmtFull(amount)}</span>
                      <span className="num text-xs text-text-dim ml-2">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-border-soft">
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-sm">Net Worth</span>
                <span className={`num text-sm font-semibold ${data.netWorth >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {data.netWorth < 0 ? '-' : ''}{fmtFull(data.netWorth)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
