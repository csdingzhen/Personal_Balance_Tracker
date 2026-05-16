import { Hono } from 'hono';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import type { CSVPreviewRow } from '../../../shared/types';

const app = new Hono();

// Parse CSV and return preview rows
app.post('/preview', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file uploaded' }, 400);

  const text = await file.text();

  try {
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const rows: CSVPreviewRow[] = records.slice(0, 50).map((r) => ({
      date: r.Date ?? r.date ?? r.DATE ?? '',
      merchantName: r.Description ?? r.description ?? r.Merchant ?? r.merchant ?? r.Name ?? '',
      amount: parseFloat(r.Amount ?? r.amount ?? '0'),
      category: r.Category ?? r.category ?? 'Uncategorized',
    }));

    return c.json({ rows });
  } catch {
    return c.json({ error: 'Failed to parse CSV. Ensure it has headers.' }, 400);
  }
});

// Confirm and import CSV rows
app.post('/confirm', async (c) => {
  const { accountId, rows } = await c.req.json() as {
    accountId: string;
    rows: CSVPreviewRow[];
  };

  if (!accountId || !rows?.length) {
    return c.json({ error: 'accountId and rows are required' }, 400);
  }

  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.transaction.create({
        data: {
          accountId,
          amount: r.amount,
          merchantName: r.merchantName || null,
          category: r.category || null,
          date: new Date(r.date),
          pending: false,
        },
      }),
    ),
  );

  return c.json({ imported: created.length });
});

export default app;
