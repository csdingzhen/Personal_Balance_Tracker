import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';

const app = new Hono<AuthEnv>();
app.use('*', requireAuth);

// ── Overview: cumulative daily spend for current + previous month ─────────────
app.get('/overview', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const month = parseInt(c.req.query('month') ?? String(now.getMonth() + 1));
  const year  = parseInt(c.req.query('year')  ?? String(now.getFullYear()));

  const curStart  = new Date(year, month - 1, 1);
  const curEnd    = new Date(year, month, 0, 23, 59, 59);
  const prevStart = new Date(year, month - 2, 1);
  const prevEnd   = new Date(year, month - 1, 0, 23, 59, 59);
  const daysInCur  = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const todayDay   = (month === now.getMonth() + 1 && year === now.getFullYear()) ? now.getDate() : daysInCur;

  const where = (start: Date, end: Date) => ({
    account: { institution: { userId }, hidden: false },
    date: { gte: start, lte: end },
    amount: { lt: 0 },
  });

  const [curTxs, prevTxs] = await Promise.all([
    prisma.transaction.findMany({ where: where(curStart, curEnd), select: { date: true, amount: true } }),
    prisma.transaction.findMany({ where: where(prevStart, prevEnd), select: { date: true, amount: true } }),
  ]);

  function buildCumulative(txs: { date: Date; amount: number }[], daysInMonth: number, maxDay: number) {
    const daily: Record<number, number> = {};
    for (const tx of txs) {
      const d = new Date(tx.date).getDate();
      daily[d] = (daily[d] ?? 0) + Math.abs(tx.amount);
    }
    const out: { day: number; amount: number | null }[] = [];
    let cum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      cum += daily[d] ?? 0;
      out.push({ day: d, amount: d <= maxDay ? Math.round(cum * 100) / 100 : null });
    }
    return out;
  }

  const totalSpend = curTxs.reduce((s, t) => s + Math.abs(t.amount), 0);

  // Last 5 transactions (all types)
  const recent = await prisma.transaction.findMany({
    where: { account: { institution: { userId }, hidden: false } },
    include: { account: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 5,
  });

  return c.json({
    totalSpend: Math.round(totalSpend * 100) / 100,
    month: curStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    currentMonth: buildCumulative(curTxs, daysInCur, todayDay),
    prevMonth: buildCumulative(prevTxs, daysInPrev, daysInPrev),
    todayDay,
    recentTransactions: recent.map(t => ({
      id: t.id,
      merchantName: t.merchantName,
      date: t.date.toISOString(),
      amount: t.amount,
      category: t.category,
      pending: t.pending,
      accountName: t.account.name,
    })),
  });
});

// ── Sankey + budget data for Breakdown page ───────────────────────────────────
app.get('/breakdown', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const month = parseInt(c.req.query('month') ?? String(now.getMonth() + 1));
  const year  = parseInt(c.req.query('year')  ?? String(now.getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);

  const txs = await prisma.transaction.findMany({
    where: { account: { institution: { userId }, hidden: false }, date: { gte: start, lte: end } },
    select: { amount: true, category: true },
  });

  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};

  const SKIP_CATS = new Set(['Transfer', 'transfer']);
  for (const tx of txs) {
    const cat = tx.category ?? 'Other';
    if (SKIP_CATS.has(cat)) continue;
    if (tx.amount > 0) income[cat]  = (income[cat]  ?? 0) + tx.amount;
    else               expenses[cat] = (expenses[cat] ?? 0) + Math.abs(tx.amount);
  }

  // Build Sankey nodes + links
  const incomeCategories  = Object.entries(income).filter(([, v]) => v > 0);
  const expenseCategories = Object.entries(expenses).filter(([, v]) => v > 0);
  const centerIdx = incomeCategories.length;

  const nodes = [
    ...incomeCategories.map(([name]) => ({ name })),
    { name: 'Spending' },
    ...expenseCategories.map(([name]) => ({ name })),
  ];

  const links = [
    ...incomeCategories.map(([, val], i) => ({ source: i, target: centerIdx, value: Math.round(val) })),
    ...expenseCategories.map(([, val], i) => ({ source: centerIdx, target: centerIdx + 1 + i, value: Math.round(val) })),
  ];

  const budgets = await prisma.budget.findMany({ where: { userId, month, year } });
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = (month === now.getMonth() + 1 && year === now.getFullYear()) ? now.getDate() : daysInMonth;

  return c.json({
    sankey: { nodes, links },
    totalIncome:  Object.values(income).reduce((s, v)  => s + v, 0),
    totalExpense: Object.values(expenses).reduce((s, v) => s + v, 0),
    budgets: budgets.map(b => ({
      ...b,
      currentSpend: expenses[b.category] ?? 0,
      daysRemaining: daysInMonth - dayOfMonth,
    })),
    daysInMonth,
    dayOfMonth,
  });
});

// ── Recurring transaction detection ──────────────────────────────────────────
app.get('/recurring', async (c) => {
  const userId = c.get('userId');

  const txs = await prisma.transaction.findMany({
    where: { account: { institution: { userId }, hidden: false } },
    select: { merchantName: true, amount: true, date: true, category: true },
    orderBy: { date: 'asc' },
  });

  // Group by merchant
  const byMerchant: Record<string, typeof txs> = {};
  for (const tx of txs) {
    const key = (tx.merchantName ?? 'Unknown').toLowerCase().trim();
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(tx);
  }

  const recurring = [];
  for (const [, group] of Object.entries(byMerchant)) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000;
      intervals.push(days);
    }
    const avg = intervals.reduce((s, d) => s + d, 0) / intervals.length;

    let frequency: string | null = null;
    if (avg >= 6  && avg <= 8)   frequency = 'weekly';
    else if (avg >= 13 && avg <= 15) frequency = 'bi-weekly';
    else if (avg >= 25 && avg <= 35) frequency = 'monthly';
    else if (avg >= 85 && avg <= 95) frequency = 'quarterly';
    else if (avg >= 355 && avg <= 375) frequency = 'annual';
    if (!frequency) continue;

    const amounts = sorted.map(t => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.map(v => (v - avgAmount) ** 2).reduce((s, v) => s + v, 0) / amounts.length);
    if (stdDev / avgAmount > 0.3) continue; // skip highly variable amounts

    const last = sorted[sorted.length - 1];
    const nextDate = new Date(last.date);
    if (frequency === 'weekly')     nextDate.setDate(nextDate.getDate() + 7);
    else if (frequency === 'bi-weekly') nextDate.setDate(nextDate.getDate() + 14);
    else if (frequency === 'monthly')   nextDate.setMonth(nextDate.getMonth() + 1);
    else if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
    else                                nextDate.setFullYear(nextDate.getFullYear() + 1);

    recurring.push({
      merchantName: sorted[0].merchantName ?? 'Unknown',
      category: sorted[0].category,
      frequency,
      amount: Math.round(avgAmount * 100) / 100,
      lastAmount: Math.abs(last.amount),
      nextDate: nextDate.toISOString(),
      isExpense: last.amount < 0,
      occurrences: sorted.slice(-6).map(t => ({
        date: new Date(t.date).toISOString().slice(0, 10),
        amount: Math.abs(t.amount),
      })),
    });
  }

  const expenses = recurring.filter(r => r.isExpense);
  const income   = recurring.filter(r => !r.isExpense);

  const monthlyFactor = (freq: string) =>
    freq === 'weekly' ? 4.33 : freq === 'bi-weekly' ? 2.17 : freq === 'monthly' ? 1 :
    freq === 'quarterly' ? 0.33 : freq === 'annual' ? 0.083 : 1;

  const monthlyExpenses = expenses.reduce((s, r) => s + r.amount * monthlyFactor(r.frequency), 0);
  const monthlyIncome   = income.reduce((s, r) => s + r.amount * monthlyFactor(r.frequency), 0);

  return c.json({
    expenses,
    income,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    monthlyIncome:   Math.round(monthlyIncome   * 100) / 100,
    netRecurring:    Math.round((monthlyIncome - monthlyExpenses) * 100) / 100,
  });
});

// ── Reports: monthly summaries, category trends, top merchants ────────────────
app.get('/reports', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const year  = parseInt(c.req.query('year')  ?? String(now.getFullYear()));
  const month = parseInt(c.req.query('month') ?? String(now.getMonth() + 1));

  const start12 = new Date(year, month - 13, 1);
  const end     = new Date(year, month, 0, 23, 59, 59);

  const allTxs = await prisma.transaction.findMany({
    where: { account: { institution: { userId }, hidden: false }, date: { gte: start12, lte: end } },
    select: { amount: true, category: true, merchantName: true, date: true },
  });

  // 12-month income vs expense
  const monthly: Record<string, { income: number; expenses: number }> = {};
  for (const tx of allTxs) {
    const key = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { income: 0, expenses: 0 };
    if (tx.amount > 0) monthly[key].income   += tx.amount;
    else               monthly[key].expenses += Math.abs(tx.amount);
  }
  const monthlyArr = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => ({ month, ...v }));

  // Category trends — last 6 months
  const start6 = new Date(year, month - 7, 1);
  const catTxs = allTxs.filter(t => new Date(t.date) >= start6 && t.amount < 0 && t.category);
  const catMonthly: Record<string, Record<string, number>> = {};
  for (const tx of catTxs) {
    const key = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`;
    const cat = tx.category!;
    if (!catMonthly[cat]) catMonthly[cat] = {};
    catMonthly[cat][key] = (catMonthly[cat][key] ?? 0) + Math.abs(tx.amount);
  }
  const last6months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    last6months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const categoryTrends = Object.entries(catMonthly)
    .filter(([cat]) => cat !== 'Income' && cat !== 'Transfer')
    .map(([cat, data]) => ({
      category: cat,
      data: last6months.map(m => ({ month: m, amount: Math.round((data[m] ?? 0) * 100) / 100 })),
    }))
    .filter(c => c.data.some(d => d.amount > 0));

  // Top merchants by total spend
  const merchantTotals: Record<string, { total: number; count: number; category: string | null }> = {};
  for (const tx of allTxs.filter(t => t.amount < 0 && t.merchantName)) {
    const m = tx.merchantName!;
    if (!merchantTotals[m]) merchantTotals[m] = { total: 0, count: 0, category: tx.category };
    merchantTotals[m].total += Math.abs(tx.amount);
    merchantTotals[m].count++;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([name, v]) => ({ name, ...v, total: Math.round(v.total * 100) / 100 }));

  // Savings rate per month
  const savingsRate = monthlyArr.map(m => ({
    month: m.month,
    rate: m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0,
  }));

  return c.json({ monthly: monthlyArr, categoryTrends, topMerchants, savingsRate, last6months });
});

export default app;
