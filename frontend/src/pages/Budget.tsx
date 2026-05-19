import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import type { Budget } from '@shared/types';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CAT_HUES: Record<string, number> = {
  'Income': 155, 'Housing': 240, 'Groceries': 140, 'Dining': 35,
  'Entertainment': 290, 'Shopping': 200, 'Transportation': 50,
  'Health & Fitness': 175, 'Travel': 210, 'Utilities': 220,
  'Healthcare': 10, 'Insurance': 270, 'Transfer': 60,
};

function catHue(category: string) {
  return CAT_HUES[category] ?? 200;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function Budget() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth  = month === now.getMonth() + 1 && year === now.getFullYear()
    ? now.getDate() : daysInMonth;
  const pacePct = (dayOfMonth / daysInMonth) * 100;

  useEffect(() => {
    setLoading(true);
    api.get<Budget[]>(`/budgets?month=${month}&year=${year}`)
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, [month, year]);

  function prev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.currentSpend, 0);
  const remaining  = totalLimit - totalSpend;

  return (
    <div className="p-7 space-y-5 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Budget</h1>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="btn h-[32px] px-2.5"><ChevronLeft size={14} /></button>
          <span className="text-text font-medium text-sm min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={next} className="btn h-[32px] px-2.5"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Total Budget</p>
          <p className="num text-2xl font-semibold text-text">{fmt(totalLimit)}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Spent</p>
          <p className={`num text-2xl font-semibold ${totalSpend > totalLimit ? 'text-negative' : 'text-text'}`}>{fmt(totalSpend)}</p>
          <p className="text-text-dim text-xs mt-1 num">Day {dayOfMonth} of {daysInMonth} · on pace for {fmt(totalSpend / dayOfMonth * daysInMonth)}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Remaining</p>
          <p className={`num text-2xl font-semibold ${remaining < 0 ? 'text-negative' : 'text-positive'}`}>
            {remaining < 0 ? '-' : ''}{fmt(Math.abs(remaining))}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="card p-10 text-center text-text-dim text-sm">No budgets for this month.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {budgets.map(b => {
            const pct = b.monthlyLimit > 0 ? Math.min((b.currentSpend / b.monthlyLimit) * 100, 100) : 0;
            const hue = catHue(b.category);
            const isOver = b.currentSpend > b.monthlyLimit;
            const isWarn = pct >= 80 && !isOver;
            const barColor = isOver ? 'oklch(0.72 0.16 28)' : isWarn ? 'oklch(0.83 0.13 80)' : `oklch(0.75 0.13 ${hue})`;
            const textColor = isOver ? 'text-negative' : isWarn ? 'text-warn' : 'text-text-2';

            return (
              <div key={b.id} className="card px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `oklch(0.75 0.13 ${hue})` }} />
                    <span className="text-text font-medium text-sm">{b.category}</span>
                  </div>
                  <span className={`num text-sm font-medium ${textColor}`}>{pct.toFixed(0)}%</span>
                </div>

                {/* Progress bar with pace marker */}
                <div className="relative w-full h-1.5 bg-surface-hi rounded-full mb-3">
                  <div className="h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColor }} />
                  {/* Pace marker */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-text-dim"
                    style={{ left: `${pacePct}%` }}
                    title={`Day ${dayOfMonth} pace`} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="num text-text-muted">{fmt(b.currentSpend)} spent</span>
                  <span className="num text-text-dim">of {fmt(b.monthlyLimit)}</span>
                </div>

                {isOver && (
                  <p className="num text-negative text-xs mt-1.5">
                    Over by {fmt(b.currentSpend - b.monthlyLimit)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
