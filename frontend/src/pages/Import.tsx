import { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Institution, CSVPreviewRow } from '@shared/types';

interface AccountGroup { institution: Institution; accounts: Account[] }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

export default function Import() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [rows, setRows] = useState<CSVPreviewRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'previewing' | 'confirmed' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts').then((groups) => {
      const all = groups.flatMap((g) => g.accounts);
      setAccounts(all);
      const moomoo = all.find((a) => a.type === 'investment' && !a.plaidAccountId);
      if (moomoo) setSelectedAccountId(moomoo.id);
    });
  }, []);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setMessage('Please upload a .csv file.'); setStatus('error'); return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.postForm<{ rows: CSVPreviewRow[] }>('/import/preview', form);
      setRows(res.rows);
      setStatus('previewing');
      setMessage('');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Parse error'); setStatus('error');
    }
  }

  async function handleConfirm() {
    if (!selectedAccountId) { setMessage('Select an account.'); return; }
    try {
      const res = await api.post<{ imported: number }>('/import/confirm', { accountId: selectedAccountId, rows });
      setStatus('confirmed');
      setMessage(`Successfully imported ${res.imported} transactions.`);
      setRows([]);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Import failed'); setStatus('error');
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Import CSV</h1>
        <p className="text-gray-400 text-sm mt-1">Import transactions from Moomoo or any bank CSV export.</p>
      </div>

      {/* Account selector */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <label className="block text-sm font-medium text-gray-300 mb-2">Target Account</label>
        <select
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        >
          <option value="">Select account...</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
        </select>
      </div>

      {/* Drop zone */}
      {status !== 'previewing' && (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 hover:border-gray-500'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Upload size={32} className="mx-auto text-gray-500 mb-3" />
          <p className="text-white font-medium">Drop your CSV file here</p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
          <p className="text-gray-600 text-xs mt-3">Expected columns: Date, Description, Amount, Category</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Status messages */}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={16} /> {message}
        </div>
      )}
      {status === 'confirmed' && (
        <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 size={16} /> {message}
          <button className="ml-auto text-xs underline" onClick={() => setStatus('idle')}>Import another</button>
        </div>
      )}

      {/* Preview Table */}
      {status === 'previewing' && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-300 text-sm">{rows.length} transactions parsed — review before importing</p>
            <button className="text-xs text-gray-500 hover:text-white" onClick={() => { setStatus('idle'); setRows([]); }}>Cancel</button>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-700/30">
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2 text-white">{r.merchantName}</td>
                    <td className="px-4 py-2 text-gray-400">{r.category}</td>
                    <td className={`px-4 py-2 text-right font-medium ${r.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                      {r.amount > 0 ? '+' : '-'}{fmt(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Confirm Import ({rows.length} transactions)
          </button>
        </div>
      )}
    </div>
  );
}
