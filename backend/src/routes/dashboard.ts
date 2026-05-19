import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import type { DashboardData, InstitutionGroup } from '../../../shared/types';

const app = new Hono();

app.get('/', async (c) => {
  const institutions = await prisma.institution.findMany({
    include: { accounts: true },
  });

  const allAccounts = institutions.flatMap((i) => i.accounts);
  const assets = allAccounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = allAccounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = assets - liabilities;

  // Generate 12-month history with a simulated upward trend
  const history = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const factor = 0.82 + (0.18 * i) / 11 + (Math.sin(i) * 0.01);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      value: Math.round(netWorth * factor),
    };
  });

  const accountsByInstitution: InstitutionGroup[] = institutions.map((inst) => ({
    institution: {
      id: inst.id,
      name: inst.name,
      logo: inst.logo,
      lastSynced: inst.lastSynced?.toISOString() ?? null,
      isPlaidLinked: inst.plaidItemId !== null,
    },
    accounts: inst.accounts.map((a) => ({
      id: a.id,
      institutionId: a.institutionId,
      name: a.name,
      type: a.type as 'checking' | 'savings' | 'credit' | 'investment',
      balance: a.balance,
      currency: a.currency,
    })),
    total: inst.accounts.reduce((s, a) => s + a.balance, 0),
  }));

  const recentTransactions = await prisma.transaction.findMany({
    take: 8,
    orderBy: { date: 'desc' },
    include: { account: true },
  });

  const data: DashboardData = {
    totalAssets: assets,
    totalLiabilities: liabilities,
    netWorth,
    history,
    accountsByInstitution,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      account: { id: t.account.id, name: t.account.name, type: t.account.type as 'checking' | 'savings' | 'credit' | 'investment' },
      amount: t.amount,
      category: t.category,
      merchantName: t.merchantName,
      date: t.date.toISOString(),
      pending: t.pending,
    })),
  };

  return c.json(data);
});

export default app;
