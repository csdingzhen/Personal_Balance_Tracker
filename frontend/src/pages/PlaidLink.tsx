import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Building2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import type { Institution } from '@shared/types';

interface AccountGroup { institution: Institution; accounts: { id: string; name: string; type: string; balance: number }[] }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function PlaidButton() {
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.post<{ link_token: string }>('/plaid/link-token', {})
      .then((r) => setToken(r.link_token))
      .catch(console.error);
  }, []);

  const onSuccess = useCallback(async (public_token: string, metadata: { institution: { name: string; institution_id: string } | null }) => {
    setLoading(true);
    try {
      await api.post('/plaid/exchange', {
        public_token,
        institution_name: metadata.institution?.name,
      });
      setLinked(true);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({ token: token ?? '', onSuccess });

  if (linked) return (
    <div className="flex items-center gap-2 text-green-400 text-sm">
      <CheckCircle2 size={16} /> Account linked successfully!
    </div>
  );

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link2 size={14} />}
      {loading ? 'Connecting...' : 'Add Account via Plaid'}
    </button>
  );
}

export default function PlaidLinkPage() {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AccountGroup[]>('/accounts')
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  const plaidConnected = groups.filter((g) => g.institution.lastSynced);

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Link Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">Connect Bank of America and SoFi via Plaid (Sandbox mode)</p>
        </div>
        <PlaidButton />
      </div>

      {/* Connected institutions */}
      <div className="space-y-4">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Connected Institutions</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : plaidConnected.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-400 text-sm">
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
                <div className="flex-1">
                  <p className="text-white font-medium">{institution.name}</p>
                  {institution.lastSynced && (
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                      <RefreshCw size={10} />
                      Last synced {new Date(institution.lastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Connected</span>
              </div>
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 last:border-0">
                  <span className="text-gray-300 text-sm">{a.name} <span className="text-gray-500 text-xs">({a.type})</span></span>
                  <span className={`text-sm font-medium ${a.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                    {a.balance < 0 ? '-' : ''}{fmt(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
        <p className="text-gray-400 text-sm font-medium mb-2">Moomoo — CSV Import Only</p>
        <p className="text-gray-500 text-xs">Moomoo does not support Plaid. Use the <span className="text-indigo-400">Import CSV</span> page to add investment transactions manually.</p>
      </div>
    </div>
  );
}
