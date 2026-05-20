import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';

const app = new Hono<AuthEnv>();
app.use('*', requireAuth);

app.get('/', async (c) => {
  const userId = c.get('userId');
  const showHidden = c.req.query('showHidden') === 'true';

  const institutions = await prisma.institution.findMany({
    where: { userId },
    include: {
      accounts: {
        where: showHidden ? {} : { hidden: false },
        orderBy: { name: 'asc' },
      },
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
        hidden: a.hidden,
      })),
    })),
  );
});

app.get('/:id', async (c) => {
  const userId = c.get('userId');
  const account = await prisma.account.findFirst({
    where: { id: c.req.param('id'), institution: { userId } },
    include: { institution: true },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);
  return c.json(account);
});

app.put('/:id', async (c) => {
  const userId = c.get('userId');
  const { hidden } = await c.req.json() as { hidden: boolean };

  const account = await prisma.account.findFirst({
    where: { id: c.req.param('id'), institution: { userId } },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);

  const updated = await prisma.account.update({
    where: { id: c.req.param('id') },
    data: { hidden },
  });
  return c.json({ id: updated.id, hidden: updated.hidden });
});

app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const account = await prisma.account.findFirst({
    where: { id, institution: { userId } },
    select: { institutionId: true },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);

  await prisma.$transaction([
    prisma.investment.deleteMany({ where: { accountId: id } }),
    prisma.transaction.deleteMany({ where: { accountId: id } }),
    prisma.account.delete({ where: { id } }),
  ]);

  const remaining = await prisma.account.count({
    where: { institutionId: account.institutionId },
  });
  if (remaining === 0) {
    await prisma.institution.delete({ where: { id: account.institutionId } });
  }

  return c.json({ success: true });
});

export default app;
