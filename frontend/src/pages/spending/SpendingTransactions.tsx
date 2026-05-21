import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../../api/client';
import type { Transaction, Account, Institution } from '@shared/types';

interface TxResponse { transactions: Transaction[]; total: number; page: number; pages: number }
interface AccountGroup { institution: Institution; accounts: Account[] }

const CAT_ICONS: Record<string, string> = {
  'Groceries': '🛒', 'Dining': '🍽️', 'Entertainment': '🎬',
  'Shopping': '🛍️', 'Transportation': '🚗', 'Housing': '🏠',
  'Health & Fitness': '💪', 'Utilities': '⚡', 'Income': '💰',
  'Travel': '✈️', 'Healthcare': '💊', 'Insurance': '🛡️',
  'Transfer': '↔️', 'Other': '📦',
};

const CAT_HUES: Record<string, number> = {
  'Income': 155, 'Housing': 240, 'Groceries': 140, 'Dining': 35,
  'Entertainment': 290, 'Shopping': 200, 'Transportation': 50,
  'Health & Fitness': 175, 'Travel': 210, 'Utilities': 220,
  'Healthcare': 10, 'Insurance': 270, 'Transfer': 60,
};

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}
function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const PRESETS = [
  { label: '7d',         getRange: () => { const e = new Date(), s = new Date(); s.setDate(e.getDate()-7); return { start: s.toISOString().slice(0,10), end: e.toISOString().slice(0,10) }; } },
  { label: '30d',        getRange: () => { const e = new Date(), s = new Date(); s.setDate(e.getDate()-30); return { start: s.toISOString().slice(0,10), end: e.toISOString().slice(0,10) }; } },
  { label: 'This month', getRange: () => { const n = new Date(); return { start: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10), end: n.toISOString().slice(0,10) }; } },
  { label: 'Last month', getRange: () => { const n = new Date(), m = n.getMonth()-1, y = m<0?n.getFullYear()-1:n.getFullYear(), mo = m<0?11:m; return { start: new Date(y,mo,1).toISOString().slice(0,10), end: new Date(y,mo+1,0).toISOString().slice(0,10) }; } },
];

const CATEGORIES = ['Income','Housing','Groceries','Dining','Entertainment','Shopping','Transportation','Health & Fitness','Travel','Utilities','Healthcare','Insurance','Transfer'];

function FilterPopover({ label, items, selected, onToggle }: { label: string; items: string[]; selected: Set<string>; onToggle: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className={`btn text-xs h-[30px] px-3 gap-1.5 ${selected.size > 0 ? 'border-accent text-accent' : ''}`} onClick={() => setOpen(o => !o)}>
        {label}{selected.size > 0 && <span className="w-4 h-4 rounded-full bg-accent text-bg-deep text-[10px] font-medium flex items-center justify-center">{selected.size}</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border-soft rounded-lg shadow-xl py-1 min-w-[180px] max-h-64 overflow-y-auto">
          {items.map(item => (
            <label key={item} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-2 cursor-pointer">
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected.has(item) ? 'bg-accent border-accent' : 'border-border-hi'}`}>
                {selected.has(item) && <svg viewBox="0 0 8 8" width="8" height="8" fill="none"><polyline points="1 4 3 6 7 2" strokeWidth="1.5" stroke="oklch(0.125 0.005 60)" /></svg>}
              </div>
              <span className="text-sm text-text-2">{item}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SpendingTransactions() {
  const [data, setData]       = useState<TxResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch]   = useState('');
  const [selAccounts, setSelAccounts] = useState<Set<string>>(new Set());
  const [selCats, setSelCats]  = useState<Set<string>>(new Set());
  const [startDate, setStart]  = useState('');
  const [endDate, setEnd]      = useState('');
  const [preset, setPreset]    = useState<string | null>('This month');
  const [incomeOnly, setIncome] = useState<boolean | null>(null);
  const [page, setPage]        = useState(1);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts').then(gs => setAccounts(gs.flatMap(g => g.accounts)));
    // default to this month
    const n = new Date();
    setStart(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10));
    setEnd(n.toISOString().slice(0, 10));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '50' });
    if (search)    p.set('search', search);
    if (startDate) p.set('startDate', startDate);
    if (endDate)   p.set('endDate', endDate);
    if (selAccounts.size === 1) p.set('accountId', [...selAccounts][0]);
    if (selCats.size === 1)     p.set('category', [...selCats][0]);
    api.get<TxResponse>(`/transactions?${p}`).then(setData).finally(() => setLoading(false));
  }, [search, selAccounts, selCats, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const txs = data?.transactions ?? [];
  const filteredTxs = incomeOnly === null ? txs
    : incomeOnly ? txs.filter(t => t.amount > 0)
    : txs.filter(t => t.amount < 0);

  const moneyIn  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Group by day
  const grouped = filteredTxs.reduce<Record<string, Transaction[]>>((acc, t) => {
    const day = t.date.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(t);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort().reverse();

  function dayLabel(iso: string) {
    const d = new Date(iso + 'T12:00:00');
    const now = new Date();
    if (iso === now.toISOString().slice(0, 10)) return 'Today';
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (iso === yest.toISOString().slice(0, 10)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function applyPreset(p: typeof PRESETS[number]) {
    const { start, end } = p.getRange();
    setStart(start); setEnd(end); setPreset(p.label); setPage(1);
  }

  const hasFilters = search || selAccounts.size || selCats.size || startDate || endDate;

  return (
    <div className="p-7 space-y-5 max-w-[1000px]">

      {/* Summary bar */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card px-4 py-3">
            <p className="eyebrow mb-1">Total Transactions</p>
            <p className="num text-xl font-semibold text-text">{data.total}</p>
          </div>
          <div className="card px-4 py-3">
            <p className="eyebrow mb-1">Money In</p>
            <p className="num text-xl font-semibold text-positive">+{fmtCompact(moneyIn)}</p>
          </div>
          <div className="card px-4 py-3">
            <p className="eyebrow mb-1">Money Out</p>
            <p className="num text-xl font-semibold text-negative">-{fmtCompact(moneyOut)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input className="w-full bg-bg-deep border border-border rounded text-sm text-text pl-8 pr-3 py-1.5 placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Search merchant..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <FilterPopover label="Accounts" items={accounts.map(a => a.id)} selected={selAccounts}
            onToggle={v => { setSelAccounts(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(1); }} />
          <FilterPopover label="Categories" items={CATEGORIES} selected={selCats}
            onToggle={v => { setSelCats(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(1); }} />
          <div className="flex gap-1">
            <button onClick={() => setIncome(null)}  className={`btn text-xs h-[30px] px-3 ${incomeOnly === null   ? 'btn-primary' : ''}`}>All</button>
            <button onClick={() => setIncome(true)}  className={`btn text-xs h-[30px] px-3 ${incomeOnly === true  ? 'btn-primary' : ''}`}>Income</button>
            <button onClick={() => setIncome(false)} className={`btn text-xs h-[30px] px-3 ${incomeOnly === false ? 'btn-primary' : ''}`}>Expenses</button>
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setSelAccounts(new Set()); setSelCats(new Set()); setStart(''); setEnd(''); setPreset(null); setPage(1); }}
              className="btn btn-ghost text-xs h-[30px] px-3"><X size={12} /> Clear</button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`btn text-xs h-[28px] px-3 ${preset === p.label ? 'btn-primary' : ''}`}>{p.label}</button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={startDate} onChange={e => { setStart(e.target.value); setPreset(null); setPage(1); }}
              className="bg-bg-deep border border-border rounded text-sm text-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent" />
            <span className="text-text-dim text-xs">–</span>
            <input type="date" value={endDate} onChange={e => { setEnd(e.target.value); setPreset(null); setPage(1); }}
              className="bg-bg-deep border border-border rounded text-sm text-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
        </div>
      </div>

      {/* Transaction list grouped by day */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div>
            {sortedDays.map(day => {
              const dayTxs = grouped[day];
              const dayNet = dayTxs.reduce((s, t) => s + t.amount, 0);
              return (
                <div key={day}>
                  <div className="flex items-center justify-between px-5 py-2 bg-bg-deep border-b border-border-soft">
                    <p className="eyebrow">{dayLabel(day)}</p>
                    <p className={`num text-xs ${dayNet >= 0 ? 'text-positive' : 'text-text-dim'}`}>
                      {dayNet >= 0 ? '+' : '-'}{fmtFull(dayNet)}
                    </p>
                  </div>
                  {dayTxs.map(t => {
                    const hue = CAT_HUES[t.category ?? ''] ?? 200;
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3 border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-surface-hi flex items-center justify-center text-base shrink-0">
                          {CAT_ICONS[t.category ?? ''] ?? '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-text-2 text-sm truncate">{t.merchantName ?? '—'}</p>
                            {t.pending && <span className="text-[9px] bg-warn-soft text-warn px-1.5 py-0.5 rounded-full font-mono">PENDING</span>}
                          </div>
                          <p className="text-text-dim text-xs mt-0.5">{t.account?.name}</p>
                        </div>
                        {t.category && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full shrink-0 hidden sm:inline-flex items-center gap-1.5"
                            style={{ background: `oklch(0.28 0.07 ${hue} / 0.5)`, color: `oklch(0.82 0.12 ${hue})` }}>
                            {t.category}
                          </span>
                        )}
                        <p className={`num text-sm font-medium shrink-0 ml-2 ${t.amount > 0 ? 'text-positive' : 'text-text'}`}>
                          {t.amount > 0 ? '+' : '-'}{fmtFull(t.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {sortedDays.length === 0 && (
              <p className="text-text-dim text-sm text-center py-10">No transactions match your filters.</p>
            )}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-soft">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-ghost text-sm disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
            <span className="eyebrow">Page {page} / {data.pages}</span>
            <button onClick={() => setPage(p => Math.min(data!.pages, p + 1))} disabled={page === data.pages}
              className="btn btn-ghost text-sm disabled:opacity-40">Next <ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
