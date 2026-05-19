import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Building2, RefreshCw, CheckCircle2, Info } from 'lucide-react';
import { api } from '../api/client';
import type { Institution } from '@shared/types';

interface AccountSummary { id: string; name: string; type: string; balance: number }
interface InstitutionGroup { institution: Institution; accounts: AccountSummary[] }
interface SyncResult { added: number; removed: number }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function freshnessPip(lastSynced: string | null) {
  if (!lastSynced) return { color: 'text-text-dim', label: 'never synced' };
  const mins = (Date.now() - new Date(lastSynced).getTime()) / 60000;
  if (mins < 5)   return { color: 'text-positive', label: `${Math.round(mins)}m ago` };
  if (mins < 60)  return { color: 'text-positive', label: `${Math.round(mins)}m ago` };
  if (mins < 1440) return { color: 'text-warn',   label: `${Math.round(mins / 60)}h ago` };
  return { color: 'text-negative', label: `${Math.round(mins / 1440)}d ago` };
}

// ── Add Account button (wraps Plaid Link) ─────────────────────────────────────
function AddAccountButton({ onLinked }: { onLinked: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    api.post<{ link_token: string }>('/plaid/link-token', {})
      .then(r => setToken(r.link_token))
      .catch(console.error);
  }, []);

  const onSuccess = useCallback(async (public_token: string, metadata: { institution: { name: string } | null }) => {
    setLinking(true);
    try {
      await api.post('/plaid/exchange', { public_token, institution_name: metadata.institution?.name });
      onLinked();
    } finally { setLinking(false); }
  }, [onLinked]);

  const { open, ready } = usePlaidLink({ token: token ?? '', onSuccess });

  return (
    <button onClick={() => open()} disabled={!ready || linking}
      className="btn btn-primary disabled:opacity-50">
      {linking
        ? <div className="w-3.5 h-3.5 border-2 border-bg-deep border-t-transparent rounded-full animate-spin" />
        : <Link2 size={14} />}
      {linking ? 'Connecting...' : 'Add Account via Plaid'}
    </button>
  );
}

// ── Per-institution sync button ───────────────────────────────────────────────
function SyncButton({ institutionId, onSynced }: { institutionId: string; onSynced: (r: SyncResult) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  async function handleSync() {
    setSyncing(true); setError(''); setResult(null);
    try {
      const r = await api.post<SyncResult>(`/plaid/sync/${institutionId}`, {});
      setResult(r);
      onSynced(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally { setSyncing(false); }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-negative text-xs">{error}</span>}
      {result && !error && (
        <span className="text-positive text-xs flex items-center gap-1 num">
          <CheckCircle2 size={11} />
          +{result.added} tx{result.removed > 0 ? ` · ${result.removed} removed` : ''}
        </span>
      )}
      <button onClick={handleSync} disabled={syncing}
        className="btn text-xs h-[28px] px-3 disabled:opacity-50">
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
  const [showSandboxNote, setShowSandboxNote] = useState(true);

  function load() {
    setLoading(true);
    api.get<InstitutionGroup[]>('/accounts')
      .then(setGroups)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const plaidConnected = groups.filter(g => g.institution.isPlaidLinked);
  const manual = groups.filter(g => !g.institution.isPlaidLinked);

  return (
    <div className="p-7 space-y-6 max-w-[700px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-text tracking-[-0.02em]">Link Accounts</h1>
          <p className="text-text-muted text-sm mt-1">Connect banks via Plaid for automatic sync</p>
        </div>
        <AddAccountButton onLinked={load} />
      </div>

      {/* Sandbox credentials note */}
      {showSandboxNote && (
        <div className="flex items-start gap-3 bg-accent-soft border border-accent/20 rounded-lg px-4 py-3">
          <Info size={15} className="text-accent mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-text-2">
            <span className="font-medium text-text">Sandbox mode</span> — use{' '}
            <code className="num text-xs bg-bg-deep px-1.5 py-0.5 rounded text-accent">user_good</code> /{' '}
            <code className="num text-xs bg-bg-deep px-1.5 py-0.5 rounded text-accent">pass_good</code> as credentials
          </div>
          <button onClick={() => setShowSandboxNote(false)} className="text-text-dim hover:text-text text-xs shrink-0">✕</button>
        </div>
      )}

      {/* Connected institutions */}
      <div className="space-y-3">
        <p className="eyebrow">Connected via Plaid</p>

        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : plaidConnected.length === 0 ? (
          <div className="card border-dashed p-8 text-center text-text-dim text-sm">
            No Plaid-connected institutions yet.
          </div>
        ) : (
          plaidConnected.map(({ institution, accounts }) => {
            const fp = freshnessPip(institution.lastSynced);
            return (
              <div key={institution.id} className="card overflow-hidden">
                <div className="card-head">
                  <div className="flex items-center gap-3">
                    {institution.logo ? (
                      <img src={institution.logo} alt={institution.name} className="w-8 h-8 rounded-full"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-hi flex items-center justify-center">
                        <Building2 size={14} className="text-text-dim" />
                      </div>
                    )}
                    <div>
                      <p className="text-text font-medium text-sm">{institution.name}</p>
                      <p className={`eyebrow mt-0.5 flex items-center gap-1.5 ${fp.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {fp.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-positive bg-positive-soft px-2 py-0.5 rounded-full">Connected</span>
                    <SyncButton institutionId={institution.id} onSynced={load} />
                  </div>
                </div>

                {accounts.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-border-soft last:border-0">
                    <span className="text-text-2 text-sm">
                      {a.name}
                      <span className="text-text-dim text-xs ml-2">({a.type})</span>
                    </span>
                    <span className={`num text-sm font-medium ${a.balance < 0 ? 'text-negative' : 'text-text'}`}>
                      {a.balance < 0 ? '-' : ''}{fmt(a.balance)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Manual / CSV institutions */}
      {manual.length > 0 && (
        <div className="space-y-3">
          <p className="eyebrow">Manual / CSV Only</p>
          {manual.map(({ institution }) => (
            <div key={institution.id} className="card px-5 py-4 flex items-center gap-3 opacity-70">
              {institution.logo ? (
                <img src={institution.logo} alt={institution.name} className="w-8 h-8 rounded-full"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-surface-hi flex items-center justify-center">
                  <Building2 size={14} className="text-text-dim" />
                </div>
              )}
              <div>
                <p className="text-text-2 text-sm font-medium">{institution.name}</p>
                <p className="eyebrow mt-0.5">Use Import CSV to add data</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
