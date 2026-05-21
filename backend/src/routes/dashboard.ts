import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';
import type { DashboardData, InstitutionGroup, NetWorthPoint } from '../../../shared/types';

const app = new Hono<AuthEnv>();
app.use('*', requireAuth);

// ── Main dashboard ────────────────────────────────────────────────────────────
app.get('/', async (c) => {
  const userId = c.get('userId');

  const institutions = await prisma.institution.findMany({
    where: { userId },
    include: { accounts: { where: { hidden: false } } },
  });

  const allAccounts = institutions.flatMap((i) => i.accounts);
  const assets = allAccounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = allAccounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = assets - liabilities;

  // Monthly history (used by 3M/6M/1Y/ALL — coarse view)
  const history = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (23 - i));
    const factor = 0.75 + (0.25 * i) / 23 + (Math.sin(i) * 0.01);
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
      isPlaidLinked: false,
    })),
    total: inst.accounts.reduce((s, a) => s + a.balance, 0),
  }));

  const recentTransactions = await prisma.transaction.findMany({
    take: 8,
    orderBy: { date: 'desc' },
    where: { account: { institution: { userId }, hidden: false } },
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

// ── Net worth history (range-aware, daily for 1M) ─────────────────────────────
app.get('/history', async (c) => {
  const userId = c.get('userId');
  const range = c.req.query('range') ?? '1M';
  const view = c.req.query('view') ?? 'all'; // 'all' | 'assets' | 'liabilities'

  const accounts = await prisma.account.findMany({
    where: { institution: { userId }, hidden: false },
    select: { balance: true },
  });
  const currentNW     = accounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets   = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalLiab     = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);

  // Scale factor to apply after building history based on current ratio
  function applyView(pts: NetWorthPoint[]): NetWorthPoint[] {
    if (view === 'assets' && currentNW !== 0) {
      const ratio = totalAssets / currentNW;
      return pts.map(p => ({ ...p, value: Math.round(p.value * ratio) }));
    }
    if (view === 'liabilities' && currentNW !== 0) {
      const ratio = totalLiab / currentNW;
      return pts.map(p => ({ ...p, value: Math.round(Math.abs(p.value) * ratio) }));
    }
    return pts;
  }

  const now = new Date();

  // ── 1M: real daily net worth derived from transactions ───────────────────
  if (range === '1M') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        account: { institution: { userId }, hidden: false },
        date: { gte: monthStart },
      },
      select: { date: true, amount: true },
      orderBy: { date: 'asc' },
    });

    // Net flow per calendar day
    const flowByDay: Record<string, number> = {};
    for (const tx of transactions) {
      const day = tx.date.toISOString().slice(0, 10);
      flowByDay[day] = (flowByDay[day] ?? 0) + tx.amount;
    }

    // Build list of every day from month start → today
    const days: string[] = [];
    const cursor = new Date(monthStart);
    cursor.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().slice(0, 10);
    while (cursor.toISOString().slice(0, 10) <= todayStr) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Walk backwards from today to reconstruct each day's net worth
    const result: NetWorthPoint[] = [];
    let nw = currentNW;
    for (let i = days.length - 1; i >= 0; i--) {
      result.unshift({ date: days[i], value: Math.round(nw) });
      nw -= (flowByDay[days[i]] ?? 0);
    }

    return c.json(applyView(result));
  }

  // ── 3M / 6M: weekly data points ─────────────────────────────────────────
  if (range === '3M' || range === '6M') {
    const weeks = range === '3M' ? 13 : 26;
    const points: NetWorthPoint[] = Array.from({ length: weeks }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (weeks - 1 - i) * 7);
      const factor = 0.80 + (0.20 * i) / (weeks - 1) + (Math.sin(i * 0.5) * 0.01);
      return { date: d.toISOString().slice(0, 10), value: Math.round(currentNW * factor) };
    });
    return c.json(applyView(points));
  }

  // ── 1Y / ALL: monthly data points ───────────────────────────────────────
  const months = range === '1Y' ? 12 : 24;
  const points: NetWorthPoint[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (months - 1 - i));
    const factor = 0.75 + (0.25 * i) / (months - 1) + (Math.sin(i) * 0.01);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      value: Math.round(currentNW * factor),
    };
  });
  return c.json(applyView(points));
});

export default app;
