import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import type { Transaction, Account, Institution } from '@shared/types';

interface TxResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
}

interface AccountGroup { institution: Institution; accounts: Account[] }

const CATEGORIES = [
  'Income', 'Housing', 'Groceries', 'Dining', 'Entertainment',
  'Shopping', 'Transportation', 'Health & Fitness', 'Travel',
  'Utilities', 'Healthcare', 'Insurance', 'Transfer',
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

export default function Transactions() {
  const [data, setData] = useState<TxResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts').then((groups) =>
      setAccounts(groups.flatMap((g) => g.accounts))
    );
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search)    params.set('search', search);
    if (accountId) params.set('accountId', accountId);
    if (category)  params.set('category', category);
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate', endDate);

    api.get<TxResponse>(`/transactions?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [search, accountId, category, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const selectClass = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Transactions</h1>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Search merchant or category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select className={selectClass} value={accountId}
          onChange={(e) => { setAccountId(e.target.value); setPage(1); }}>
          <option value="">All Accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select className={selectClass} value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <input type="date" className={selectClass} value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          <span className="text-gray-500 text-sm">–</span>
          <input type="date" className={selectClass} value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>

        {(search || accountId || category || startDate || endDate) && (
          <button className="text-xs text-gray-400 hover:text-white" onClick={() => {
            setSearch(''); setAccountId(''); setCategory(''); setStartDate(''); setEndDate(''); setPage(1);
          }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <p className="text-gray-400 text-sm">
            {data ? `${data.total} transaction${data.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Merchant</th>
                <th className="text-left px-6 py-3">Category</th>
                <th className="text-left px-6 py-3">Account</th>
                <th className="text-right px-6 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data?.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-3 text-gray-400 text-sm whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-3 text-white text-sm">{t.merchantName ?? '—'}</td>
                  <td className="px-6 py-3">
                    {t.category && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                        {t.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-sm">{t.account?.name ?? '—'}</td>
                  <td className={`px-6 py-3 text-sm font-medium text-right ${t.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                    {t.amount > 0 ? '+' : '-'}{fmt(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-sm text-gray-400">Page {page} of {data.pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
