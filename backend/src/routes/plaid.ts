import { Hono } from 'hono';
import { Products, CountryCode } from 'plaid';
import { getPlaidClient } from '../lib/plaid';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../lib/encryption';

const app = new Hono();

/** Extract a readable message from a Plaid AxiosError. */
function plaidErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error_message?: string; error_code?: string } } };
  if (e?.response?.data?.error_message) {
    return `${e.response.data.error_code}: ${e.response.data.error_message}`;
  }
  return String(err);
}

// ── Create Plaid Link token ───────────────────────────────────────────────────
app.post('/link-token', async (c) => {
  try {
    const response = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Personal Balance Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return c.json({ link_token: response.data.link_token });
  } catch (err) {
    const msg = plaidErrorMessage(err);
    console.error('Plaid link-token error:', msg);
    return c.json({ error: msg }, 500);
  }
});

// ── Exchange public token, store encrypted access token ───────────────────────
app.post('/exchange', async (c) => {
  const { public_token, institution_name, institution_logo } = await c.req.json();

  try {
    const client = getPlaidClient();
    const exchangeRes = await client.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeRes.data.access_token;
    const itemId = exchangeRes.data.item_id;

    const accountsRes = await client.accountsGet({ access_token: accessToken });
    const plaidAccounts = accountsRes.data.accounts;

    const institution = await prisma.institution.upsert({
      where: { plaidItemId: itemId },
      create: {
        name: institution_name ?? 'Unknown Bank',
        logo: institution_logo ?? null,
        lastSynced: new Date(),
        plaidItemId: itemId,
        accessToken: encrypt(accessToken),
      },
      update: {
        name: institution_name ?? 'Unknown Bank',
        lastSynced: new Date(),
        accessToken: encrypt(accessToken),
      },
    });

    for (const pa of plaidAccounts) {
      await prisma.account.upsert({
        where: { plaidAccountId: pa.account_id },
        create: {
          institutionId: institution.id,
          name: pa.name,
          type: pa.subtype ?? pa.type,
          balance: pa.balances.current ?? 0,
          currency: pa.balances.iso_currency_code ?? 'USD',
          plaidAccountId: pa.account_id,
        },
        update: {
          balance: pa.balances.current ?? 0,
          name: pa.name,
        },
      });
    }

    return c.json({ success: true, institution_id: institution.id });
  } catch (err) {
    const msg = plaidErrorMessage(err);
    console.error('Plaid exchange error:', msg);
    return c.json({ error: msg }, 500);
  }
});

// ── Sync balances + transactions for a linked institution ─────────────────────
app.post('/sync/:institutionId', async (c) => {
  const institution = await prisma.institution.findUnique({
    where: { id: c.req.param('institutionId') },
    include: { accounts: true },
  });

  if (!institution) return c.json({ error: 'Institution not found' }, 404);
  if (!institution.accessToken) {
    return c.json({ error: 'Institution has no linked Plaid account' }, 400);
  }

  let accessToken: string;
  try {
    accessToken = decrypt(institution.accessToken);
  } catch {
    return c.json({ error: 'Failed to decrypt access token — check ENCRYPTION_KEY' }, 500);
  }

  try {
    const client = getPlaidClient();

    // 1. Refresh account balances
    const accountsRes = await client.accountsGet({ access_token: accessToken });
    for (const pa of accountsRes.data.accounts) {
      await prisma.account.updateMany({
        where: { plaidAccountId: pa.account_id },
        data: { balance: pa.balances.current ?? 0 },
      });
    }

    // 2. Sync transactions via cursor (paginated)
    let cursor: string | undefined = institution.plaidCursor ?? undefined;
    let totalAdded = 0;
    let totalRemoved = 0;
    let hasMore = true;

    while (hasMore) {
      const txRes = await client.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      });

      const { added, modified, removed, next_cursor, has_more } = txRes.data;

      for (const tx of added) {
        const account = institution.accounts.find((a) => a.plaidAccountId === tx.account_id);
        if (!account) continue;
        await prisma.transaction.upsert({
          where: { plaidTransactionId: tx.transaction_id },
          create: {
            accountId: account.id,
            amount: -tx.amount, // Plaid positive = debit → store as negative
            category: tx.personal_finance_category?.primary?.replace(/_/g, ' ')
              ?? tx.category?.[0] ?? null,
            merchantName: tx.merchant_name ?? tx.name ?? null,
            date: new Date(tx.date),
            pending: tx.pending,
            plaidTransactionId: tx.transaction_id,
          },
          update: {
            amount: -tx.amount,
            pending: tx.pending,
            merchantName: tx.merchant_name ?? tx.name ?? null,
            category: tx.personal_finance_category?.primary?.replace(/_/g, ' ')
              ?? tx.category?.[0] ?? null,
          },
        });
        totalAdded++;
      }

      for (const tx of modified) {
        await prisma.transaction.updateMany({
          where: { plaidTransactionId: tx.transaction_id },
          data: {
            amount: -tx.amount,
            pending: tx.pending,
            merchantName: tx.merchant_name ?? tx.name ?? null,
          },
        });
      }

      for (const tx of removed) {
        await prisma.transaction.deleteMany({
          where: { plaidTransactionId: tx.transaction_id },
        });
        totalRemoved++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    await prisma.institution.update({
      where: { id: institution.id },
      data: { plaidCursor: cursor, lastSynced: new Date() },
    });

    return c.json({ success: true, added: totalAdded, removed: totalRemoved });
  } catch (err) {
    const msg = plaidErrorMessage(err);
    console.error('Plaid sync error:', msg);
    return c.json({ error: msg }, 500);
  }
});

export default app;
