import { Hono } from 'hono';
import { prisma } from '../lib/prisma';

const app = new Hono();

app.get('/', async (c) => {
  const showHidden = c.req.query('showHidden') === 'true';

  const institutions = await prisma.institution.findMany({
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
  const account = await prisma.account.findUnique({
    where: { id: c.req.param('id') },
    include: { institution: true },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);
  return c.json(account);
});

// Toggle hidden status
app.patch('/:id', async (c) => {
  const { hidden } = await c.req.json() as { hidden: boolean };
  const account = await prisma.account.update({
    where: { id: c.req.param('id') },
    data: { hidden },
  });
  return c.json({ id: account.id, hidden: account.hidden });
});

// Delete account and all related data
app.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const account = await prisma.account.findUnique({
    where: { id },
    select: { institutionId: true },
  });
  if (!account) return c.json({ error: 'Not found' }, 404);

  await prisma.$transaction([
    prisma.investment.deleteMany({ where: { accountId: id } }),
    prisma.transaction.deleteMany({ where: { accountId: id } }),
    prisma.account.delete({ where: { id } }),
  ]);

  // Clean up institution if it has no remaining accounts
  const remaining = await prisma.account.count({
    where: { institutionId: account.institutionId },
  });
  if (remaining === 0) {
    await prisma.institution.delete({ where: { id: account.institutionId } });
  }

  return c.json({ success: true });
});

export default app;
