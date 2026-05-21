import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../../api/client';

const CAT_ICONS: Record<string, string> = {
  'Groceries': '🛒', 'Dining': '🍽️', 'Entertainment': '🎬',
  'Shopping': '🛍️', 'Transportation': '🚗', 'Housing': '🏠',
  'Health & Fitness': '💪', 'Utilities': '⚡', 'Income': '💰',
  'Travel': '✈️', 'Healthcare': '💊', 'Insurance': '🛡️',
  'Transfer': '↔️', 'Other': '📦',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtCompact(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface RecurringItem {
  merchantName: string;
  category: string | null;
  frequency: string;
  amount: number;
  lastAmount: number;
  nextDate: string;
  isExpense: boolean;
  occurrences: { date: string; amount: number }[];
}

interface RecurringData {
  expenses: RecurringItem[];
  income: RecurringItem[];
  monthlyExpenses: number;
  monthlyIncome: number;
  netRecurring: number;
}

// Tiny sparkline for last N occurrences
function Sparkline({ data, color }: { data: { amount: number }[]; color: string }) {
  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
        <Line type="monotone" dataKey="amount" stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ background: 'oklch(0.195 0.005 60)', border: 'none', borderRadius: 6, fontSize: 10, fontFamily: 'Geist Mono' }}
          formatter={(v: number) => [fmt(v)]}
          labelFormatter={() => ''}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RecurringRow({ item }: { item: RecurringItem }) {
  const color = item.isExpense ? 'oklch(0.72 0.16 28)' : 'oklch(0.80 0.15 155)';
  const nextDate = new Date(item.nextDate);
  const daysUntil = Math.round((nextDate.getTime() - Date.now()) / 86400000);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border-soft last:border-0 hover:bg-surface-2 transition-colors">
      {/* Icon + name */}
      <div className="w-9 h-9 rounded-xl bg-surface-hi flex items-center justify-center text-base shrink-0">
        {CAT_ICONS[item.category ?? ''] ?? '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-2 text-sm font-medium truncate">{item.merchantName}</p>
        <p className="eyebrow mt-0.5">{item.category} · <span className="capitalize">{item.frequency}</span></p>
      </div>

      {/* Next date */}
      <div className="text-right shrink-0 w-24 hidden md:block">
        <p className="text-text-2 text-xs">{nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        <p className="eyebrow mt-0.5">
          {daysUntil <= 0 ? 'due today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil}d`}
        </p>
      </div>

      {/* Sparkline */}
      <div className="shrink-0 hidden lg:block">
        <Sparkline data={item.occurrences} color={color} />
      </div>

      {/* Amount */}
      <p className={`num text-sm font-semibold shrink-0 w-24 text-right ${item.isExpense ? 'text-negative' : 'text-positive'}`}>
        {item.isExpense ? '-' : '+'}{fmt(item.amount)}<span className="text-text-dim text-[10px]">/mo</span>
      </p>
    </div>
  );
}

export default function SpendingRecurring() {
  const [data, setData] = useState<RecurringData | null>(null);

  useEffect(() => {
    api.get<RecurringData>('/spending/recurring').then(setData);
  }, []);

  if (!data) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  return (
    <div className="p-7 space-y-6 max-w-[1000px]">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Monthly Recurring Expenses</p>
          <p className="num text-2xl font-semibold text-negative">-{fmtCompact(data.monthlyExpenses)}</p>
          <p className="text-text-dim text-xs mt-1">{data.expenses.length} recurring payments</p>
        </div>
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Monthly Recurring Income</p>
          <p className="num text-2xl font-semibold text-positive">+{fmtCompact(data.monthlyIncome)}</p>
          <p className="text-text-dim text-xs mt-1">{data.income.length} recurring sources</p>
        </div>
        <div className="card px-5 py-4">
          <p className="eyebrow mb-1">Net Recurring Cash Flow</p>
          <p className={`num text-2xl font-semibold ${data.netRecurring >= 0 ? 'text-positive' : 'text-negative'}`}>
            {data.netRecurring >= 0 ? '+' : '-'}{fmtCompact(Math.abs(data.netRecurring))}
          </p>
          <p className="text-text-dim text-xs mt-1">per month</p>
        </div>
      </div>

      {/* Recurring Expenses */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-negative" />
            <p className="text-text font-medium">Recurring Expenses</p>
          </div>
          <p className="num text-sm text-negative">-{fmtCompact(data.monthlyExpenses)}/mo</p>
        </div>
        {data.expenses.length === 0 ? (
          <p className="text-text-dim text-sm text-center py-8">
            No recurring expenses detected yet. More transaction history helps the algorithm.
          </p>
        ) : (
          data.expenses
            .sort((a, b) => b.amount - a.amount)
            .map((item, i) => <RecurringRow key={i} item={item} />)
        )}
      </div>

      {/* Recurring Income */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-positive" />
            <p className="text-text font-medium">Recurring Income</p>
          </div>
          <p className="num text-sm text-positive">+{fmtCompact(data.monthlyIncome)}/mo</p>
        </div>
        {data.income.length === 0 ? (
          <p className="text-text-dim text-sm text-center py-8">No recurring income detected yet.</p>
        ) : (
          data.income
            .sort((a, b) => b.amount - a.amount)
            .map((item, i) => <RecurringRow key={i} item={item} />)
        )}
      </div>

      <p className="text-text-dim text-xs text-center">
        Recurring items are auto-detected from transactions with the same merchant, consistent amount, and regular interval (±30% variance allowed).
      </p>
    </div>
  );
}
