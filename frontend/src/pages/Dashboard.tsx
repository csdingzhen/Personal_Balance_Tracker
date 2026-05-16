import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData, Transaction } from '@shared/types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function accountTypeBadge(type: string) {
  const map: Record<string, string> = {
    checking: 'bg-blue-500/20 text-blue-400',
    savings: 'bg-green-500/20 text-green-400',
    credit: 'bg-red-500/20 text-red-400',
    investment: 'bg-purple-500/20 text-purple-400',
  };
  return map[type] ?? 'bg-gray-500/20 text-gray-400';
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!data) return (
    <div className="p-8 flex items-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  const prevNetWorth = data.history.length >= 2 ? data.history[data.history.length - 2].value : data.netWorth;
  const change = data.netWorth - prevNetWorth;
  const changePct = prevNetWorth > 0 ? (change / prevNetWorth) * 100 : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Net Worth</p>
          <p className="text-3xl font-bold text-white mt-2">{fmt(data.netWorth)}</p>
          <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {fmtFull(change)} ({Math.abs(changePct).toFixed(1)}%) vs last month
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Assets</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{fmt(data.totalAssets)}</p>
          <p className="text-gray-500 text-sm mt-2">Across all accounts</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Total Liabilities</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{fmt(data.totalLiabilities)}</p>
          <p className="text-gray-500 text-sm mt-2">Credit card balances</p>
        </div>
      </div>

      {/* Net Worth Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={16} className="text-indigo-400" />
          <h2 className="text-white font-semibold">Net Worth History</h2>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v: number) => [fmt(v), 'Net Worth']}
            />
            <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2}
              fill="url(#nwGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Accounts by Institution */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">Accounts</h2>
          <div className="space-y-4">
            {data.accountsByInstitution.map(({ institution, accounts }) => (
              <div key={institution.id}>
                <div className="flex items-center gap-2 mb-2">
                  {institution.logo && (
                    <img src={institution.logo} alt={institution.name}
                      className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span className="text-gray-300 text-sm font-medium">{institution.name}</span>
                </div>
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 pl-7">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accountTypeBadge(a.type)}`}>
                        {a.type}
                      </span>
                      <span className="text-gray-400 text-sm">{a.name}</span>
                    </div>
                    <span className={`text-sm font-medium ${a.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                      {a.balance < 0 ? '-' : ''}{fmtFull(a.balance)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">Recent Transactions</h2>
          <div className="space-y-1">
            {data.recentTransactions.map((t: Transaction) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div>
                  <p className="text-white text-sm">{t.merchantName ?? 'Unknown'}</p>
                  <p className="text-gray-500 text-xs">{t.category} · {new Date(t.date).toLocaleDateString()}</p>
                </div>
                <span className={`text-sm font-medium ${t.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                  {t.amount > 0 ? '+' : ''}{fmtFull(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
