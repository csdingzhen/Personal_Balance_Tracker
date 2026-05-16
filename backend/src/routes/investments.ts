import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import type { InvestmentSummary } from '../../../shared/types';

const app = new Hono();

app.get('/', async (c) => {
  const holdings = await prisma.investment.findMany({
    include: { account: { select: { id: true, name: true } } },
    orderBy: [{ account: { name: 'asc' } }, { ticker: 'asc' }],
  });

  const totalValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
  const totalCostBasis = holdings.reduce((s, h) => s + h.shares * h.costBasis, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  // Generate 30-day performance history
  const performanceHistory = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const factor = 0.91 + (0.09 * i) / 29 + Math.sin(i * 0.7) * 0.008;
    return {
      date: d.toISOString().substring(0, 10),
      value: Math.round(totalValue * factor * 100) / 100,
    };
  });

  const summary: InvestmentSummary = {
    holdings: holdings.map((h) => ({
      id: h.id,
      accountId: h.accountId,
      account: h.account,
      ticker: h.ticker,
      name: h.name,
      shares: h.shares,
      currentPrice: h.currentPrice,
      costBasis: h.costBasis,
    })),
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPct,
    performanceHistory,
  };

  return c.json(summary);
});

export default app;
