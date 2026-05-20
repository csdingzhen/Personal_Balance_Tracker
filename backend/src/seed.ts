import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function main() {
  console.log('Seeding database...');

  await prisma.investment.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.user.deleteMany();

  // ── Demo user ─────────────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      username: 'demo',
      passwordHash: await bcrypt.hash('demo1234', 12),
    },
  });
  console.log(`  Created user: demo (password: demo1234)`);

  // ── Institutions ──────────────────────────────────────────────────────────
  const boa = await prisma.institution.create({
    data: { userId: user.id, id: 'inst_boa', name: 'Bank of America', logo: 'https://logo.clearbit.com/bankofamerica.com', lastSynced: new Date('2026-05-16T08:00:00Z') },
  });
  const sofi = await prisma.institution.create({
    data: { userId: user.id, id: 'inst_sofi', name: 'SoFi', logo: 'https://logo.clearbit.com/sofi.com', lastSynced: new Date('2026-05-16T08:00:00Z') },
  });
  const moomoo = await prisma.institution.create({
    data: { userId: user.id, id: 'inst_moomoo', name: 'Moomoo', logo: 'https://logo.clearbit.com/moomoo.com', lastSynced: null },
  });

  // ── Accounts ──────────────────────────────────────────────────────────────
  const boaChecking = await prisma.account.create({ data: { id: 'acc_boa_chk', institutionId: boa.id, name: 'BOA Checking', type: 'checking', balance: 4523.18 } });
  await prisma.account.create({ data: { id: 'acc_boa_sav', institutionId: boa.id, name: 'BOA Savings', type: 'savings', balance: 12750.00 } });
  const boaCC = await prisma.account.create({ data: { id: 'acc_boa_cc', institutionId: boa.id, name: 'BOA Cash Rewards', type: 'credit', balance: -1234.56 } });
  const sofiChecking = await prisma.account.create({ data: { id: 'acc_sofi_chk', institutionId: sofi.id, name: 'SoFi Checking', type: 'checking', balance: 8901.23 } });
  await prisma.account.create({ data: { id: 'acc_sofi_sav', institutionId: sofi.id, name: 'SoFi Savings', type: 'savings', balance: 25000.00 } });
  const sofiCC = await prisma.account.create({ data: { id: 'acc_sofi_cc', institutionId: sofi.id, name: 'SoFi Credit Card', type: 'credit', balance: -567.89 } });
  const sofiInvest = await prisma.account.create({ data: { id: 'acc_sofi_inv', institutionId: sofi.id, name: 'SoFi Invest', type: 'investment', balance: 15234.60 } });
  const moomooInvest = await prisma.account.create({ data: { id: 'acc_moomoo', institutionId: moomoo.id, name: 'Moomoo Brokerage', type: 'investment', balance: 41022.04 } });

  // ── Transactions ──────────────────────────────────────────────────────────
  const txData = [
    { accountId: boaChecking.id, date: '2026-05-01', merchantName: 'Direct Deposit - Employer', amount: 5500.00, category: 'Income' },
    { accountId: boaChecking.id, date: '2026-05-01', merchantName: 'Landlord Rent Payment', amount: -2200.00, category: 'Housing' },
    { accountId: boaCC.id, date: '2026-05-02', merchantName: 'Netflix', amount: -15.99, category: 'Entertainment' },
    { accountId: boaCC.id, date: '2026-05-03', merchantName: 'Spotify', amount: -10.99, category: 'Entertainment' },
    { accountId: boaChecking.id, date: '2026-05-05', merchantName: "Trader Joe's", amount: -134.23, category: 'Groceries' },
    { accountId: boaCC.id, date: '2026-05-07', merchantName: 'Amazon.com', amount: -67.34, category: 'Shopping' },
    { accountId: sofiChecking.id, date: '2026-05-08', merchantName: 'Transfer from BOA', amount: 1000.00, category: 'Transfer' },
    { accountId: boaCC.id, date: '2026-05-09', merchantName: 'Nobu Restaurant', amount: -89.50, category: 'Dining' },
    { accountId: boaChecking.id, date: '2026-05-10', merchantName: 'Shell Gas Station', amount: -48.50, category: 'Transportation' },
    { accountId: sofiCC.id, date: '2026-05-11', merchantName: 'Uber', amount: -18.45, category: 'Transportation' },
    { accountId: boaChecking.id, date: '2026-05-12', merchantName: 'Target', amount: -156.78, category: 'Shopping' },
    { accountId: boaCC.id, date: '2026-05-13', merchantName: 'H&M', amount: -89.00, category: 'Shopping' },
    { accountId: sofiChecking.id, date: '2026-05-14', merchantName: 'Planet Fitness', amount: -24.99, category: 'Health & Fitness' },
    { accountId: boaChecking.id, date: '2026-05-15', merchantName: 'Whole Foods Market', amount: -89.23, category: 'Groceries' },
    { accountId: boaChecking.id, date: '2026-04-01', merchantName: 'Direct Deposit - Employer', amount: 5500.00, category: 'Income' },
    { accountId: boaChecking.id, date: '2026-04-01', merchantName: 'Landlord Rent Payment', amount: -2200.00, category: 'Housing' },
    { accountId: boaChecking.id, date: '2026-04-03', merchantName: 'Pacific Gas & Electric', amount: -95.40, category: 'Utilities' },
    { accountId: boaCC.id, date: '2026-04-05', merchantName: 'Amazon.com', amount: -234.56, category: 'Shopping' },
    { accountId: boaCC.id, date: '2026-04-07', merchantName: 'Chipotle Mexican Grill', amount: -15.67, category: 'Dining' },
    { accountId: boaCC.id, date: '2026-04-09', merchantName: 'Starbucks', amount: -7.45, category: 'Dining' },
    { accountId: sofiChecking.id, date: '2026-04-14', merchantName: 'Planet Fitness', amount: -24.99, category: 'Health & Fitness' },
    { accountId: sofiCC.id, date: '2026-04-16', merchantName: 'Southwest Airlines', amount: -345.00, category: 'Travel' },
    { accountId: sofiCC.id, date: '2026-04-17', merchantName: 'Hilton Hotels', amount: -245.00, category: 'Travel' },
    { accountId: sofiCC.id, date: '2026-04-18', merchantName: 'Uber', amount: -24.50, category: 'Transportation' },
    { accountId: boaChecking.id, date: '2026-04-20', merchantName: 'CVS Pharmacy', amount: -34.56, category: 'Healthcare' },
    { accountId: boaCC.id, date: '2026-04-22', merchantName: 'Apple.com', amount: -14.99, category: 'Entertainment' },
    { accountId: boaChecking.id, date: '2026-04-25', merchantName: 'Costco Wholesale', amount: -234.56, category: 'Groceries' },
    { accountId: boaCC.id, date: '2026-04-28', merchantName: 'DoorDash', amount: -45.23, category: 'Dining' },
    { accountId: boaChecking.id, date: '2026-03-01', merchantName: 'Direct Deposit - Employer', amount: 5500.00, category: 'Income' },
    { accountId: boaChecking.id, date: '2026-03-01', merchantName: 'Landlord Rent Payment', amount: -2200.00, category: 'Housing' },
    { accountId: boaChecking.id, date: '2026-03-03', merchantName: 'Pacific Gas & Electric', amount: -112.34, category: 'Utilities' },
    { accountId: boaCC.id, date: '2026-03-05', merchantName: 'Netflix', amount: -15.99, category: 'Entertainment' },
    { accountId: boaChecking.id, date: '2026-03-07', merchantName: "Trader Joe's", amount: -167.45, category: 'Groceries' },
    { accountId: boaCC.id, date: '2026-03-10', merchantName: 'H&M', amount: -156.78, category: 'Shopping' },
    { accountId: sofiChecking.id, date: '2026-03-14', merchantName: 'Planet Fitness', amount: -24.99, category: 'Health & Fitness' },
    { accountId: boaCC.id, date: '2026-03-15', merchantName: 'Amazon.com', amount: -89.99, category: 'Shopping' },
    { accountId: boaChecking.id, date: '2026-03-17', merchantName: 'Shell Gas Station', amount: -56.78, category: 'Transportation' },
    { accountId: sofiCC.id, date: '2026-03-19', merchantName: 'Cheesecake Factory', amount: -78.45, category: 'Dining' },
    { accountId: boaChecking.id, date: '2026-03-21', merchantName: 'USAA Insurance', amount: -178.50, category: 'Insurance' },
    { accountId: boaCC.id, date: '2026-03-23', merchantName: 'Hulu', amount: -17.99, category: 'Entertainment' },
    { accountId: boaChecking.id, date: '2026-03-25', merchantName: 'Whole Foods Market', amount: -145.67, category: 'Groceries' },
    { accountId: boaCC.id, date: '2026-03-28', merchantName: 'DoorDash', amount: -38.90, category: 'Dining' },
  ];

  for (const tx of txData) {
    await prisma.transaction.create({
      data: { accountId: tx.accountId, amount: tx.amount, merchantName: tx.merchantName, category: tx.category, date: new Date(tx.date), pending: false },
    });
  }

  // ── Budgets (May 2026) ────────────────────────────────────────────────────
  const budgets = [
    { category: 'Housing', monthlyLimit: 2500, currentSpend: 2200.00 },
    { category: 'Groceries', monthlyLimit: 500, currentSpend: 223.46 },
    { category: 'Dining', monthlyLimit: 300, currentSpend: 89.50 },
    { category: 'Entertainment', monthlyLimit: 100, currentSpend: 26.98 },
    { category: 'Shopping', monthlyLimit: 400, currentSpend: 313.12 },
    { category: 'Transportation', monthlyLimit: 200, currentSpend: 66.95 },
    { category: 'Health & Fitness', monthlyLimit: 50, currentSpend: 24.99 },
    { category: 'Utilities', monthlyLimit: 150, currentSpend: 0 },
  ];
  for (const b of budgets) {
    await prisma.budget.create({ data: { ...b, userId: user.id, month: 5, year: 2026 } });
  }

  // ── Investments ───────────────────────────────────────────────────────────
  for (const h of [
    { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 45, currentPrice: 227.18, costBasis: 195.00 },
    { ticker: 'VXUS', name: 'Vanguard Total International ETF', shares: 50, currentPrice: 58.23, costBasis: 52.50 },
    { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', shares: 30, currentPrice: 70.00, costBasis: 71.00 },
  ]) {
    await prisma.investment.create({ data: { ...h, accountId: sofiInvest.id } });
  }
  for (const h of [
    { ticker: 'AAPL', name: 'Apple Inc.', shares: 80, currentPrice: 198.45, costBasis: 172.00 },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', shares: 10, currentPrice: 875.23, costBasis: 620.00 },
    { ticker: 'MSFT', name: 'Microsoft Corporation', shares: 20, currentPrice: 425.67, costBasis: 385.00 },
    { ticker: 'TSLA', name: 'Tesla Inc.', shares: 15, currentPrice: 242.34, costBasis: 265.00 },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', shares: 15, currentPrice: 189.56, costBasis: 158.00 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', shares: 8, currentPrice: 175.23, costBasis: 145.00 },
  ]) {
    await prisma.investment.create({ data: { ...h, accountId: moomooInvest.id } });
  }

  console.log(`Seed complete! Login with username: demo, password: demo1234`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
