import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../api/client';
import type { InvestmentSummary, Investment } from '@shared/types';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function fmt(n: number, digits = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function Investments() {
  const [data, setData] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InvestmentSummary>('/investments')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading portfolio...
    </div>
  );
  if (!data) return null;

  const pieData = data.holdings.map((h) => ({
    name: h.ticker,
    value: Math.round(h.shares * h.currentPrice * 100) / 100,
  }));

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Investment Portfolio</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Portfolio Value</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(data.totalValue)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Cost</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(data.totalCostBasis)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Gain/Loss</p>
          <p className={`text-2xl font-bold mt-1 ${data.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.totalGainLoss >= 0 ? '+' : ''}{fmt(data.totalGainLoss)}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Return</p>
          <div className={`flex items-center gap-1 mt-1 ${data.totalGainLossPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.totalGainLossPct >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <p className="text-2xl font-bold">{fmtPct(data.totalGainLossPct)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Performance Chart */}
        <div className="col-span-3 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">30-Day Performance</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.performanceHistory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v.slice(5)} interval={6} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Value']}
              />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation Donut */}
        <div className="col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-white font-semibold mb-4">Allocation</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                dataKey="value" paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Value']}
              />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Holdings</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-6 py-3">Ticker</th>
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Account</th>
              <th className="text-right px-6 py-3">Shares</th>
              <th className="text-right px-6 py-3">Price</th>
              <th className="text-right px-6 py-3">Value</th>
              <th className="text-right px-6 py-3">Cost Basis</th>
              <th className="text-right px-6 py-3">Gain/Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {data.holdings.map((h: Investment) => {
              const value = h.shares * h.currentPrice;
              const cost = h.shares * h.costBasis;
              const gl = value - cost;
              const glPct = cost > 0 ? (gl / cost) * 100 : 0;
              return (
                <tr key={h.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-3 font-mono font-bold text-indigo-400">{h.ticker}</td>
                  <td className="px-6 py-3 text-gray-300 text-sm">{h.name}</td>
                  <td className="px-6 py-3 text-gray-400 text-sm">{h.account?.name}</td>
                  <td className="px-6 py-3 text-white text-right font-mono">{h.shares}</td>
                  <td className="px-6 py-3 text-white text-right">{fmt(h.currentPrice)}</td>
                  <td className="px-6 py-3 text-white text-right font-medium">{fmt(value)}</td>
                  <td className="px-6 py-3 text-gray-400 text-right">{fmt(cost)}</td>
                  <td className={`px-6 py-3 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {gl >= 0 ? '+' : ''}{fmt(gl)}<br />
                    <span className="text-xs">{fmtPct(glPct)}</span>
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
