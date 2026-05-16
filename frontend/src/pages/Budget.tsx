import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Budget } from '@shared/types';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function categoryColor(pct: number) {
  if (pct >= 100) return { bar: 'bg-red-500', text: 'text-red-400' };
  if (pct >= 80)  return { bar: 'bg-yellow-500', text: 'text-yellow-400' };
  return { bar: 'bg-indigo-500', text: 'text-indigo-400' };
}

export default function Budget() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Budget[]>(`/budgets?month=${month}&year=${year}`)
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, [month, year]);

  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.currentSpend, 0);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Budget</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">‹</button>
          <span className="text-white font-medium min-w-32 text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">›</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Budget</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(totalLimit)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Spent</p>
          <p className={`text-2xl font-bold mt-1 ${totalSpend > totalLimit ? 'text-red-400' : 'text-white'}`}>{fmt(totalSpend)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${totalLimit - totalSpend < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {fmt(Math.abs(totalLimit - totalSpend))} {totalLimit - totalSpend < 0 ? 'over' : 'left'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">
          No budgets for this month.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {budgets.map((b) => {
            const pct = b.monthlyLimit > 0 ? Math.min((b.currentSpend / b.monthlyLimit) * 100, 100) : 0;
            const { bar, text } = categoryColor(pct);
            return (
              <div key={b.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-medium">{b.category}</span>
                  <span className={`text-sm font-semibold ${text}`}>{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{fmt(b.currentSpend)} spent</span>
                  <span className="text-gray-500">of {fmt(b.monthlyLimit)}</span>
                </div>
                {b.currentSpend > b.monthlyLimit && (
                  <p className="text-red-400 text-xs mt-2">
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
