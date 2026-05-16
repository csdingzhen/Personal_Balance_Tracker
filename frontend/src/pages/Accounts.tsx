import { useEffect, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { Account, Institution } from '@shared/types';

interface InstitutionGroup {
  institution: Institution;
  accounts: Account[];
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

export default function Accounts() {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InstitutionGroup[]>('/accounts')
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-gray-400">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading accounts...
    </div>
  );

  const totalNet = groups.flatMap((g) => g.accounts).reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">
            Net balance: <span className={totalNet >= 0 ? 'text-green-400' : 'text-red-400'}>{totalNet < 0 ? '-' : ''}{fmt(totalNet)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(({ institution, accounts }) => {
          const instTotal = accounts.reduce((s, a) => s + a.balance, 0);
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
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className={`font-semibold ${instTotal < 0 ? 'text-red-400' : 'text-white'}`}>
                    {instTotal < 0 ? '-' : ''}{fmt(instTotal)}
                  </p>
                </div>
              </div>

              {/* Accounts list */}
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 last:border-0 hover:bg-gray-750">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeBadge(account.type)}`}>
                      {account.type}
                    </span>
                    <span className="text-gray-200 text-sm">{account.name}</span>
                    {!account.plaidAccountId && account.type !== 'investment' && (
                      <span className="text-xs text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-full">Manual</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${account.balance < 0 ? 'text-red-400' : 'text-white'}`}>
                      {account.balance < 0 ? '-' : ''}{fmt(account.balance)}
                    </p>
                    <p className="text-gray-500 text-xs">{account.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
