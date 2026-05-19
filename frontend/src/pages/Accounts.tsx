import { useEffect, useState } from 'react';
import { Building2, RefreshCw, Pencil, Trash2, Eye, EyeOff, X, Check } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Institution } from '@shared/types';

interface AccountWithHidden extends Account { hidden: boolean }
interface InstitutionGroup { institution: Institution; accounts: AccountWithHidden[] }

const TYPE_STYLES: Record<string, { dot: string; label: string }> = {
  checking:   { dot: 'oklch(0.76 0.12 220)', label: 'Checking' },
  savings:    { dot: 'oklch(0.80 0.15 155)', label: 'Savings' },
  credit:     { dot: 'oklch(0.72 0.16 28)',  label: 'Credit' },
  investment: { dot: 'oklch(0.86 0.13 200)', label: 'Invest' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function DeleteConfirm({ account, onConfirm, onCancel }: {
  account: AccountWithHidden; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-text font-semibold text-lg mb-2">Delete account?</h3>
        <p className="text-text-muted text-sm mb-1">
          <span className="text-text">{account.name}</span> and all its transactions and investments will be permanently deleted.
        </p>
        <p className="text-negative text-xs mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn flex-1 justify-center">Cancel</button>
          <button onClick={onConfirm}
            className="btn btn-primary flex-1 justify-center"
            style={{ background: 'oklch(0.72 0.16 28)', color: 'white' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Accounts() {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AccountWithHidden | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    api.get<InstitutionGroup[]>('/accounts?showHidden=true')
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggleHidden(account: AccountWithHidden) {
    setBusy(s => new Set(s).add(account.id));
    try {
      await api.put(`/accounts/${account.id}`, { hidden: !account.hidden });
      setGroups(prev => prev.map(g => ({
        ...g,
        accounts: g.accounts.map(a => a.id === account.id ? { ...a, hidden: !a.hidden } : a),
      })));
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(account.id); return n; });
    }
  }

  async function deleteAccount(account: AccountWithHidden) {
    setPendingDelete(null);
    setBusy(s => new Set(s).add(account.id));
    try {
      await api.del(`/accounts/${account.id}`);
      setGroups(prev =>
        prev.map(g => ({ ...g, accounts: g.accounts.filter(a => a.id !== account.id) }))
          .filter(g => g.accounts.length > 0)
      );
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(account.id); return n; });
    }
  }

  const allAccounts = groups.flatMap(g => g.accounts);
  const visible = allAccounts.filter(a => !a.hidden);
  const assets = visible.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = visible.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const net = assets - liabilities;
  const hiddenCount = allAccounts.filter(a => a.hidden).length;

  if (loading) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  return (
    <div className="p-7 space-y-5 max-w-[900px]">
      {pendingDelete && (
        <DeleteConfirm account={pendingDelete}
          onConfirm={() => deleteAccount(pendingDelete)}
          onCancel={() => setPendingDelete(null)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Accounts</h1>
          {/* Assets / Liabilities / Net split */}
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="eyebrow">Assets</p>
              <p className="num text-sm font-medium text-positive mt-0.5">{fmt(assets)}</p>
            </div>
            <div className="h-6 w-px bg-border-soft" />
            <div>
              <p className="eyebrow">Liabilities</p>
              <p className="num text-sm font-medium text-negative mt-0.5">{fmt(liabilities)}</p>
            </div>
            <div className="h-6 w-px bg-border-soft" />
            <div>
              <p className="eyebrow">Net</p>
              <p className={`num text-sm font-medium mt-0.5 ${net >= 0 ? 'text-text' : 'text-negative'}`}>
                {net < 0 ? '-' : ''}{fmt(net)}
              </p>
            </div>
            {hiddenCount > 0 && !editMode && (
              <span className="text-text-dim text-xs ml-1">{hiddenCount} hidden</span>
            )}
          </div>
        </div>

        <button
          onClick={() => setEditMode(e => !e)}
          className={`btn ${editMode ? 'btn-primary' : ''}`}>
          {editMode ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit</>}
        </button>
      </div>

      {editMode && (
        <div className="flex items-center gap-2 bg-accent-soft border border-accent/20 rounded-lg px-4 py-2.5 text-sm text-accent">
          <Pencil size={13} />
          Hide accounts to exclude them from all views, or delete to permanently remove all data.
        </div>
      )}

      {/* Groups */}
      <div className="space-y-4">
        {groups.map(({ institution, accounts }) => {
          const instTotal = accounts.filter(a => !a.hidden).reduce((s, a) => s + a.balance, 0);
          return (
            <div key={institution.id} className="card overflow-hidden">
              {/* Institution header */}
              <div className="card-head">
                <div className="flex items-center gap-3">
                  {institution.logo ? (
                    <img src={institution.logo} alt={institution.name}
                      className="w-8 h-8 rounded-full bg-surface-hi"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-hi flex items-center justify-center">
                      <Building2 size={14} className="text-text-dim" />
                    </div>
                  )}
                  <div>
                    <p className="text-text font-medium text-sm">{institution.name}</p>
                    {institution.lastSynced && (
                      <p className="eyebrow flex items-center gap-1 mt-0.5">
                        <RefreshCw size={9} />
                        {new Date(institution.lastSynced).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {!editMode && (
                  <div className="text-right">
                    <p className="eyebrow">Total</p>
                    <p className={`num text-sm font-medium mt-0.5 ${instTotal < 0 ? 'text-negative' : 'text-text'}`}>
                      {instTotal < 0 ? '-' : ''}{fmt(instTotal)}
                    </p>
                  </div>
                )}
              </div>

              {/* Account rows */}
              {accounts.map(account => {
                const isBusy = busy.has(account.id);
                const ts = TYPE_STYLES[account.type] ?? TYPE_STYLES.checking;
                return (
                  <div key={account.id}
                    className={`flex items-center justify-between px-5 py-3.5 border-b border-border-soft last:border-0 transition-opacity ${account.hidden ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ts.dot }} />
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${account.hidden ? 'line-through text-text-muted' : 'text-text-2'}`}>
                          {account.name}
                        </p>
                        <p className="eyebrow mt-0.5">{ts.label}{account.hidden ? ' · hidden' : ''}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <p className={`num text-sm font-medium ${account.balance < 0 ? 'text-negative' : editMode ? 'text-text-muted' : 'text-text'}`}>
                        {account.balance < 0 ? '-' : ''}{fmt(account.balance)}
                      </p>

                      {editMode && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleHidden(account)} disabled={isBusy}
                            title={account.hidden ? 'Show' : 'Hide'}
                            className="btn btn-ghost h-[30px] px-2 disabled:opacity-40">
                            {isBusy
                              ? <div className="w-3.5 h-3.5 border-2 border-text-dim border-t-transparent rounded-full animate-spin" />
                              : account.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button onClick={() => setPendingDelete(account)} disabled={isBusy}
                            className="btn btn-ghost h-[30px] px-2 disabled:opacity-40 hover:text-negative">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {editMode && (
        <button onClick={() => setEditMode(false)}
          className="flex items-center gap-2 btn btn-ghost text-sm mx-auto">
          <X size={13} /> Exit edit mode
        </button>
      )}
    </div>
  );
}
