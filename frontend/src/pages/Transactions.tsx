import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../api/client';
import type { Transaction, Account, Institution } from '@shared/types';

interface TxResponse { transactions: Transaction[]; total: number; page: number; pages: number }
interface AccountGroup { institution: Institution; accounts: Account[] }

// ── Category color system ─────────────────────────────────────────────────────
const CAT_HUES: Record<string, number> = {
  'Income': 155, 'Housing': 240, 'Groceries': 140, 'Dining': 35,
  'Entertainment': 290, 'Shopping': 200, 'Transportation': 50,
  'Health & Fitness': 175, 'Travel': 210, 'Utilities': 220,
  'Healthcare': 10, 'Insurance': 270, 'Transfer': 60,
};

function catStyle(cat: string | null) {
  const hue = cat ? (CAT_HUES[cat] ?? 200) : 200;
  return {
    background: `oklch(0.28 0.07 ${hue} / 0.5)`,
    color: `oklch(0.82 0.12 ${hue})`,
    dot: `oklch(0.75 0.13 ${hue})`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

const PRESETS = [
  { label: '7d',          days: 7 },
  { label: '30d',         days: 30 },
  { label: 'This month',  days: 0, thisMonth: true },
  { label: 'Last month',  days: 0, lastMonth: true },
  { label: 'YTD',         days: 0, ytd: true },
];

function getPresetDates(p: typeof PRESETS[number]) {
  const now = new Date();
  if (p.thisMonth) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }
  if (p.lastMonth) {
    const m = now.getMonth() - 1;
    const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const mo = m < 0 ? 11 : m;
    return {
      start: new Date(y, mo, 1).toISOString().slice(0, 10),
      end: new Date(y, mo + 1, 0).toISOString().slice(0, 10),
    };
  }
  if (p.ytd) {
    return {
      start: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }
  const d = new Date(now);
  d.setDate(d.getDate() - p.days);
  return { start: d.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}

// ── Popover filter ────────────────────────────────────────────────────────────
function FilterPopover({
  label, items, selected, onToggle,
}: { label: string; items: string[]; selected: Set<string>; onToggle: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className={`btn text-xs h-[30px] px-3 gap-1.5 ${selected.size > 0 ? 'border-accent text-accent' : ''}`}
        onClick={() => setOpen(o => !o)}>
        {label}
        {selected.size > 0 && (
          <span className="w-4 h-4 rounded-full bg-accent text-bg-deep text-[10px] font-medium flex items-center justify-center">
            {selected.size}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border-soft rounded-lg shadow-xl py-1 min-w-[180px]">
          {items.map(item => (
            <label key={item} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 cursor-pointer">
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                selected.has(item) ? 'bg-accent border-accent' : 'border-border-hi'
              }`}>
                {selected.has(item) && <svg viewBox="0 0 8 8" width="8" height="8" fill="oklch(0.125 0.005 60)"><polyline points="1 4 3 6 7 2" strokeWidth="1.5" stroke="oklch(0.125 0.005 60)" fill="none"/></svg>}
              </div>
              <span className="text-sm text-text-2">{item}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['Income','Housing','Groceries','Dining','Entertainment','Shopping','Transportation','Health & Fitness','Travel','Utilities','Healthcare','Insurance','Transfer'];

export default function Transactions() {
  const [data, setData] = useState<TxResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats]    = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts')
      .then(gs => setAccounts(gs.flatMap(g => g.accounts)));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search)      params.set('search', search);
    if (startDate)   params.set('startDate', startDate);
    if (endDate)     params.set('endDate', endDate);
    // multiple accounts / categories: send first selected only (simple version)
    if (selectedAccounts.size === 1) params.set('accountId', [...selectedAccounts][0]);
    if (selectedCats.size === 1)     params.set('category', [...selectedCats][0]);

    api.get<TxResponse>(`/transactions?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [search, selectedAccounts, selectedCats, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p: typeof PRESETS[number]) {
    const { start, end } = getPresetDates(p);
    setStartDate(start); setEndDate(end);
    setActivePreset(p.label); setPage(1);
  }

  function clearAll() {
    setSearch(''); setSelectedAccounts(new Set()); setSelectedCats(new Set());
    setStartDate(''); setEndDate(''); setActivePreset(null); setPage(1);
  }

  const hasFilters = search || selectedAccounts.size || selectedCats.size || startDate || endDate;

  // ── Summary stats ──────────────────────────────────────────────────────────
  const txs = data?.transactions ?? [];
  const moneyIn  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netFlow  = moneyIn - moneyOut;
  const days     = new Set(txs.map(t => t.date.slice(0, 10))).size || 1;
  const avgPerDay = moneyOut / days;

  // ── Group by day ───────────────────────────────────────────────────────────
  const grouped = txs.reduce<Record<string, Transaction[]>>((acc, t) => {
    const day = t.date.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(t);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort().reverse();

  return (
    <div className="p-7 space-y-5 max-w-[1100px]">
      <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Transactions</h1>

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Net Flow',  value: netFlow,    positive: netFlow >= 0 },
            { label: 'Money In',  value: moneyIn,    positive: true },
            { label: 'Money Out', value: -moneyOut,  positive: false },
            { label: 'Avg / Day', value: -avgPerDay, positive: false },
          ].map(({ label, value, positive }) => (
            <div key={label} className="card px-4 py-3">
              <p className="eyebrow mb-1">{label}</p>
              <p className={`num text-lg font-semibold ${positive ? 'text-positive' : value < 0 ? 'text-negative' : 'text-text'}`}>
                {value >= 0 ? '' : '-'}{fmtFull(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="card p-3 space-y-3">
        {/* Row 1: search + popovers */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              className="w-full bg-bg-deep border border-border rounded text-sm text-text pl-8 pr-3 py-1.5 placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Search merchant or notes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <FilterPopover label="Accounts" items={accounts.map(a => a.id)}
            selected={selectedAccounts}
            onToggle={v => { setSelectedAccounts(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(1); }} />
          <FilterPopover label="Categories" items={CATEGORIES}
            selected={selectedCats}
            onToggle={v => { setSelectedCats(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(1); }} />
          {hasFilters && (
            <button onClick={clearAll} className="btn-ghost btn text-xs h-[30px] px-3">
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Row 2: date presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => applyPreset(p)}
              className={`btn text-xs h-[28px] px-3 ${activePreset === p.label ? 'btn-primary' : ''}`}>
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={startDate}
              onChange={e => { setStartDate(e.target.value); setActivePreset(null); setPage(1); }}
              className="bg-bg-deep border border-border rounded text-sm text-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent" />
            <span className="text-text-dim text-xs">–</span>
            <input type="date" value={endDate}
              onChange={e => { setEndDate(e.target.value); setActivePreset(null); setPage(1); }}
              className="bg-bg-deep border border-border rounded text-sm text-text px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
        </div>
      </div>

      {/* ── Transaction list (day-grouped) ────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-soft">
          <p className="text-text-muted text-sm">{data ? `${data.total} transactions` : ''}</p>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {sortedDays.map(day => {
              const dayTxs = grouped[day];
              const dayNet = dayTxs.reduce((s, t) => s + t.amount, 0);
              return (
                <div key={day}>
                  {/* Day header */}
                  <div className="flex items-center justify-between px-5 py-2 bg-bg-deep border-b border-border-soft sticky top-0 z-10">
                    <p className="eyebrow">
                      {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className={`num text-xs ${dayNet >= 0 ? 'text-positive' : 'text-text-dim'}`}>
                      {dayNet >= 0 ? '+' : '-'}{fmtFull(dayNet)}
                    </p>
                  </div>

                  {dayTxs.map(t => {
                    const cs = catStyle(t.category);
                    return (
                      <div key={t.id}
                        className="flex items-center justify-between px-5 py-3 border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-hi flex items-center justify-center shrink-0 text-sm">
                            {t.merchantName?.[0] ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-text-2 text-sm truncate">{t.merchantName ?? '—'}</p>
                            <p className="text-text-dim text-xs mt-0.5">{t.account?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {t.category && (
                            <span className="cat-pill text-[11px] hidden sm:inline-flex" style={{ background: cs.background, color: cs.color, boxShadow: 'none' }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cs.dot }} />
                              {t.category}
                            </span>
                          )}
                          <p className={`num text-sm font-medium ${t.amount > 0 ? 'text-positive' : 'text-text'}`}>
                            {t.amount > 0 ? '+' : '-'}{fmtFull(t.amount)}
                          </p>
                        </div>
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

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-soft">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-ghost text-sm disabled:opacity-40">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="eyebrow">Page {page} / {data.pages}</span>
            <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
              className="btn btn-ghost text-sm disabled:opacity-40">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
