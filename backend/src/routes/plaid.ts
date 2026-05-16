import { Hono } from 'hono';
import { Products, CountryCode } from 'plaid';
import { plaidClient } from '../lib/plaid';
import { prisma } from '../lib/prisma';

const app = new Hono();

app.post('/link-token', async (c) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Personal Balance Tracker',
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return c.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid link token error:', err);
    return c.json({ error: 'Failed to create link token' }, 500);
  }
});

app.post('/exchange', async (c) => {
  const { public_token, institution_name, institution_logo } = await c.req.json();

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeRes.data.access_token;
    const itemId = exchangeRes.data.item_id;

    // Fetch accounts from Plaid
    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
    const plaidAccounts = accountsRes.data.accounts;

    // Upsert institution
    const institution = await prisma.institution.upsert({
      where: { plaidItemId: itemId },
      create: {
        name: institution_name ?? 'Unknown Bank',
        logo: institution_logo ?? null,
        lastSynced: new Date(),
        plaidItemId: itemId,
      },
      update: { lastSynced: new Date(), name: institution_name ?? 'Unknown Bank' },
    });

    // Upsert accounts
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
    console.error('Plaid exchange error:', err);
    return c.json({ error: 'Failed to exchange token' }, 500);
  }
});

export default app;
