import { Hono } from 'hono';
import { prisma } from '../lib/prisma';

const app = new Hono();

app.get('/', async (c) => {
  const { search, accountId, category, startDate, endDate, page = '1', limit = '50' } = c.req.query();

  const where: Parameters<typeof prisma.transaction.findMany>[0]['where'] = {};

  if (accountId) where.accountId = accountId;
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { merchantName: { contains: search } },
      { category: { contains: search } },
    ];
  }
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: { select: { id: true, name: true, type: true } } },
      orderBy: { date: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.transaction.count({ where }),
  ]);

  return c.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      account: t.account,
      amount: t.amount,
      category: t.category,
      merchantName: t.merchantName,
      date: t.date.toISOString(),
      pending: t.pending,
    })),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
  });
});

app.post('/', async (c) => {
  const body = await c.req.json();
  const tx = await prisma.transaction.create({
    data: {
      accountId: body.accountId,
      amount: body.amount,
      category: body.category ?? null,
      merchantName: body.merchantName ?? null,
      date: new Date(body.date),
      pending: body.pending ?? false,
    },
  });
  return c.json(tx, 201);
});

app.get('/categories', async (c) => {
  const rows = await prisma.transaction.findMany({
    select: { category: true },
    distinct: ['category'],
    where: { category: { not: null } },
  });
  return c.json(rows.map((r) => r.category).filter(Boolean));
});

export default app;
