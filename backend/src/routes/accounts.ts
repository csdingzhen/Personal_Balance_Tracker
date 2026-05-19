import { Hono } from 'hono';
import { prisma } from '../lib/prisma';

const app = new Hono();

app.get('/', async (c) => {
  const institutions = await prisma.institution.findMany({
    include: {
      accounts: { orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  return c.json(
    institutions.map((inst) => ({
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
        type: a.type,
        balance: a.balance,
        currency: a.currency,
        plaidAccountId: a.plaidAccountId,
      })),
    })),
  );
});

app.get('/:id', async (c) => {
  const account = await prisma.account.findUnique({
    where: { id: c.req.param('id') },
    include: { institution: true },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);
  return c.json(account);
});

export default app;
