import { useEffect, useState } from 'react';
import { Building2, RefreshCw, Pencil, Trash2, Eye, EyeOff, X, Check } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Institution } from '@shared/types';

interface AccountWithHidden extends Account { hidden: boolean }
interface InstitutionGroup {
  institution: Institution;
  accounts: AccountWithHidden[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    checking:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
    savings:    'bg-green-500/20 text-green-400 border-green-500/30',
    credit:     'bg-red-500/20 text-red-400 border-red-500/30',
    investment: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return map[type] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────
function DeleteConfirm({
  account,
  onConfirm,
  onCancel,
}: {
  account: AccountWithHidden;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold text-lg mb-2">Delete account?</h3>
        <p className="text-gray-400 text-sm mb-1">
          <span className="text-white">{account.name}</span> and all its associated
          transactions and investments will be permanently deleted.
        </p>
        <p className="text-red-400 text-xs mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Accounts() {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AccountWithHidden | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  function load(showHidden = true) {
    setLoading(true);
    api.get<InstitutionGroup[]>(`/accounts?showHidden=${showHidden}`)
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(true); }, []);

  async function toggleHidden(account: AccountWithHidden) {
    setBusy((s) => new Set(s).add(account.id));
    try {
      await api.put(`/accounts/${account.id}`, { hidden: !account.hidden });
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          accounts: g.accounts.map((a) =>
            a.id === account.id ? { ...a, hidden: !a.hidden } : a
          ),
        }))
      );
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(account.id); return n; });
    }
  }

  async function deleteAccount(account: AccountWithHidden) {
    setPendingDelete(null);
    setBusy((s) => new Set(s).add(account.id));
    try {
      await api.del(`/accounts/${account.id}`);
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, accounts: g.accounts.filter((a) => a.id !== account.id) }))
          .filter((g) => g.accounts.length > 0)
      );
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(account.id); return n; });
    }
  }

  const allAccounts = groups.flatMap((g) => g.accounts);
  const visibleAccounts = allAccounts.filter((a) => !a.hidden);
  const totalNet = visibleAccounts.reduce((s, a) => s + a.balance, 0);
  const hiddenCount = allAccounts.filter((a) => a.hidden).length;

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading accounts...
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      {pendingDelete && (
        <DeleteConfirm
          account={pendingDelete}
          onConfirm={() => deleteAccount(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">
            Net balance:{' '}
            <span className={totalNet >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalNet < 0 ? '-' : ''}{fmt(totalNet)}
            </span>
            {hiddenCount > 0 && !editMode && (
              <span className="ml-3 text-gray-600 text-xs">{hiddenCount} hidden</span>
            )}
          </p>
        </div>

        <button
          onClick={() => setEditMode((e) => !e)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            editMode
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600'
          }`}
        >
          {editMode ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit Accounts</>}
        </button>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg px-4 py-2.5 text-sm text-indigo-300">
          <Pencil size={13} />
          Edit mode — hide accounts to exclude them from all views, or delete to permanently remove all data.
        </div>
      )}

      {/* Institution groups */}
      <div className="space-y-6">
        {groups.map(({ institution, accounts }) => {
          const visibleAccs = accounts.filter((a) => !a.hidden);
          const instTotal = visibleAccs.reduce((s, a) => s + a.balance, 0);

          return (
            <div key={institution.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* Institution header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  {institution.logo ? (
                    <img src={institution.logo} alt={institution.name}
                      className="w-8 h-8 rounded-full bg-gray-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      <Building2 size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold">{institution.name}</p>
                    {institution.lastSynced && (
                      <p className="text-gray-500 text-xs flex items-center gap-1">
                        <RefreshCw size={10} />
                        Synced {new Date(institution.lastSynced).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {!editMode && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className={`font-semibold ${instTotal < 0 ? 'text-red-400' : 'text-white'}`}>
                      {instTotal < 0 ? '-' : ''}{fmt(instTotal)}
                    </p>
                  </div>
                )}
              </div>

              {/* Accounts */}
              {accounts.map((account) => {
                const isBusy = busy.has(account.id);
                return (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between px-6 py-4 border-b border-gray-700/50 last:border-0 transition-opacity ${
                      account.hidden ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${typeBadge(account.type)}`}>
                        {account.type}
                      </span>
                      <span className={`text-sm truncate ${account.hidden ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                        {account.name}
                      </span>
                      {account.hidden && (
                        <span className="text-xs text-gray-600 shrink-0">hidden</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {!editMode && (
                        <div className="text-right">
                          <p className={`font-semibold ${account.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                            {account.balance < 0 ? '-' : ''}{fmt(account.balance)}
                          </p>
                          <p className="text-gray-500 text-xs">{account.currency}</p>
                        </div>
                      )}

                      {editMode && (
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium mr-2 ${account.balance < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                            {account.balance < 0 ? '-' : ''}{fmt(account.balance)}
                          </p>

                          {/* Hide / Show toggle */}
                          <button
                            onClick={() => toggleHidden(account)}
                            disabled={isBusy}
                            title={account.hidden ? 'Show account' : 'Hide account'}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
                          >
                            {isBusy
                              ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              : account.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setPendingDelete(account)}
                            disabled={isBusy}
                            title="Delete account and all data"
                            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={15} />
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

      {/* Exit edit mode shortcut */}
      {editMode && (
        <button
          onClick={() => setEditMode(false)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mx-auto"
        >
          <X size={14} /> Exit edit mode
        </button>
      )}
    </div>
  );
}
