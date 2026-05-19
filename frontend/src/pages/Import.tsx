import { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Institution, CSVPreviewRow } from '@shared/types';

interface AccountGroup { institution: Institution; accounts: Account[] }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

type Step = 'account' | 'upload' | 'preview' | 'done';

const STEPS: { id: Step; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'upload',  label: 'Upload' },
  { id: 'preview', label: 'Preview' },
  { id: 'done',    label: 'Done' },
];

export default function Import() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<CSVPreviewRow[]>([]);
  const [step, setStep] = useState<Step>('account');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts').then(gs => {
      const all = gs.flatMap(g => g.accounts);
      setAccounts(all);
      const moomoo = all.find(a => a.type === 'investment' && !a.plaidAccountId);
      if (moomoo) setSelectedId(moomoo.id);
    });
  }, []);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file.'); return; }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.postForm<{ rows: CSVPreviewRow[] }>('/import/preview', form);
      setRows(res.rows);
      setStep('preview');
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Parse error');
    }
  }

  async function handleConfirm() {
    if (!selectedId) { setError('Select an account first.'); return; }
    try {
      const res = await api.post<{ imported: number }>('/import/confirm', { accountId: selectedId, rows });
      setImportCount(res.imported);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="p-7 space-y-6 max-w-[720px]">
      <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Import CSV</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium font-mono transition-colors ${
                done ? 'bg-positive text-bg-deep' : active ? 'bg-accent text-bg-deep' : 'bg-surface-hi text-text-dim'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${active ? 'text-text font-medium' : 'text-text-dim'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-text-dim mx-1" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-negative bg-negative-soft border border-negative/20 rounded-lg px-4 py-3 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Step: Account */}
      {(step === 'account' || step === 'upload') && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="eyebrow mb-2">Target Account</p>
            <select
              className="w-full bg-bg-deep border border-border rounded text-sm text-text px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
            </select>
          </div>
          {selectedId && step === 'account' && (
            <button onClick={() => setStep('upload')} className="btn btn-primary w-full justify-center">
              Continue to Upload
            </button>
          )}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-lg p-14 text-center cursor-pointer transition-colors ${
            dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-hi'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload size={28} className="mx-auto text-text-dim mb-3" />
          <p className="text-text font-medium">Drop your CSV here</p>
          <p className="text-text-muted text-sm mt-1">or click to browse</p>
          <p className="eyebrow mt-4">Expected: Date · Description · Amount · Category</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-text-muted text-sm">{rows.length} transactions parsed — review before importing</p>
            <button onClick={() => { setStep('upload'); setRows([]); }} className="btn btn-ghost text-xs">
              Re-upload
            </button>
          </div>

          <div className="card overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border-soft">
                <tr className="text-[10px] text-text-dim uppercase tracking-[0.1em] font-mono">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-2.5 text-text-muted num text-xs whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2.5 text-text-2">{r.merchantName}</td>
                    <td className="px-4 py-2.5 text-text-muted text-xs">{r.category}</td>
                    <td className={`px-4 py-2.5 text-right num font-medium ${r.amount > 0 ? 'text-positive' : 'text-text'}`}>
                      {r.amount > 0 ? '+' : '-'}{fmt(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={handleConfirm} className="btn btn-primary w-full justify-center">
            Import {rows.length} transactions
          </button>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="card p-8 text-center space-y-3">
          <CheckCircle2 size={32} className="mx-auto text-positive" />
          <p className="text-text font-medium text-lg">Import complete</p>
          <p className="text-text-muted text-sm">
            {importCount} transaction{importCount !== 1 ? 's' : ''} added to your account.
          </p>
          <button onClick={() => { setStep('account'); setRows([]); setError(''); setImportCount(0); }}
            className="btn btn-primary">
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
