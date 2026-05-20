import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';

const app = new Hono<AuthEnv>();
app.use('*', requireAuth);

app.get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const month = parseInt(c.req.query('month') ?? String(now.getMonth() + 1));
  const year = parseInt(c.req.query('year') ?? String(now.getFullYear()));

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const budgets = await prisma.budget.findMany({ where: { userId, month, year } });

  const txByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    _sum: { amount: true },
    where: {
      date: { gte: monthStart, lte: monthEnd },
      amount: { lt: 0 },
      category: { not: null },
      account: { institution: { userId }, hidden: false },
    },
  });

  const spendMap = Object.fromEntries(
    txByCategory.map((r) => [r.category, Math.abs(r._sum.amount ?? 0)]),
  );

  return c.json(
    budgets.map((b) => ({
      id: b.id,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      currentSpend: spendMap[b.category] ?? b.currentSpend,
      month: b.month,
      year: b.year,
    })),
  );
});

app.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const now = new Date();
  const month = body.month ?? now.getMonth() + 1;
  const year = body.year ?? now.getFullYear();

  const budget = await prisma.budget.upsert({
    where: { userId_category_month_year: { userId, category: body.category, month, year } },
    create: { userId, category: body.category, monthlyLimit: body.monthlyLimit, currentSpend: 0, month, year },
    update: { monthlyLimit: body.monthlyLimit },
  });
  return c.json(budget, 201);
});

app.put('/:id', async (c) => {
  const userId = c.get('userId');
  const budget = await prisma.budget.findFirst({ where: { id: c.req.param('id'), userId } });
  if (!budget) return c.json({ error: 'Not found' }, 404);

  const updated = await prisma.budget.update({
    where: { id: c.req.param('id') },
    data: { monthlyLimit: (await c.req.json()).monthlyLimit },
  });
  return c.json(updated);
});

app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const budget = await prisma.budget.findFirst({ where: { id: c.req.param('id'), userId } });
  if (!budget) return c.json({ error: 'Not found' }, 404);

  await prisma.budget.delete({ where: { id: c.req.param('id') } });
  return c.json({ success: true });
});

export default app;
