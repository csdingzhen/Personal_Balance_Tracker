import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Building2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import type { Institution } from '@shared/types';

interface AccountSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface InstitutionGroup {
  institution: Institution;
  accounts: AccountSummary[];
}

interface SyncResult {
  added: number;
  removed: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

// ── Add Account button (wraps Plaid Link) ────────────────────────────────────
function AddAccountButton({ onLinked }: { onLinked: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    api.post<{ link_token: string }>('/plaid/link-token', {})
      .then((r) => setToken(r.link_token))
      .catch(console.error);
  }, []);

  const onSuccess = useCallback(
    async (public_token: string, metadata: { institution: { name: string } | null }) => {
      setLinking(true);
      try {
        await api.post('/plaid/exchange', {
          public_token,
          institution_name: metadata.institution?.name,
        });
        onLinked();
      } finally {
        setLinking(false);
      }
    },
    [onLinked],
  );

  const { open, ready } = usePlaidLink({ token: token ?? '', onSuccess });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || linking}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {linking
        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : <Link2 size={14} />}
      {linking ? 'Connecting...' : 'Add Account via Plaid'}
    </button>
  );
}

// ── Per-institution Sync Now button ───────────────────────────────────────────
function SyncButton({ institutionId, onSynced }: { institutionId: string; onSynced: (result: SyncResult) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  async function handleSync() {
    setSyncing(true);
    setError('');
    setLast(null);
    try {
      const result = await api.post<SyncResult>(`/plaid/sync/${institutionId}`, {});
      setLast(result);
      onSynced(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      {last && !error && (
        <span className="text-green-400 text-xs flex items-center gap-1">
          <CheckCircle2 size={12} />
          +{last.added} tx{last.removed > 0 ? `, ${last.removed} removed` : ''}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg transition-colors"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlaidLinkPage() {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  function loadAccounts() {
    setLoading(true);
    api.get<InstitutionGroup[]>('/accounts')
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAccounts(); }, []);

  const plaidConnected = groups.filter((g) => g.institution.isPlaidLinked);
  const unlinked = groups.filter((g) => !g.institution.isPlaidLinked);

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Link Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">
            Connect BOA and SoFi via Plaid · Sandbox: use <code className="text-indigo-400 bg-gray-800 px-1 rounded">user_good</code> / <code className="text-indigo-400 bg-gray-800 px-1 rounded">pass_good</code>
          </p>
        </div>
        <AddAccountButton onLinked={loadAccounts} />
      </div>

      {/* Plaid-connected institutions */}
      <div className="space-y-3">
        <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Connected via Plaid</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : plaidConnected.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-dashed border-gray-600 p-8 text-center text-gray-500 text-sm">
            No Plaid-connected institutions yet. Click "Add Account" to get started.
          </div>
        ) : (
          plaidConnected.map(({ institution, accounts }) => (
            <div key={institution.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
                {institution.logo ? (
                  <img src={institution.logo} alt={institution.name} className="w-8 h-8 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <Building2 size={14} className="text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{institution.name}</p>
                  <p className="text-gray-500 text-xs">
                    Last synced {institution.lastSynced
                      ? new Date(institution.lastSynced).toLocaleString()
                      : 'never'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Connected</span>
                  <SyncButton
                    institutionId={institution.id}
                    onSynced={loadAccounts}
                  />
                </div>
              </div>

              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-700/40 last:border-0">
                  <span className="text-gray-300 text-sm">
                    {a.name}
                    <span className="text-gray-500 text-xs ml-2">({a.type})</span>
                  </span>
                  <span className={`text-sm font-medium ${a.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                    {a.balance < 0 ? '-' : ''}{fmt(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Manual/CSV-only institutions */}
      {unlinked.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Manual / CSV Only</h2>
          {unlinked.map(({ institution }) => (
            <div key={institution.id} className="bg-gray-800/50 rounded-xl border border-gray-700 px-5 py-4 flex items-center gap-3">
              {institution.logo ? (
                <img src={institution.logo} alt={institution.name} className="w-8 h-8 rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <Building2 size={14} className="text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-gray-300 font-medium">{institution.name}</p>
                <p className="text-gray-500 text-xs">
                  Use the <span className="text-indigo-400">Import CSV</span> page to add data
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
