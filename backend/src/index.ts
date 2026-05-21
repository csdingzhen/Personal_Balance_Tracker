import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import authRoutes from './routes/auth';
import dashboard from './routes/dashboard';
import accounts from './routes/accounts';
import transactions from './routes/transactions';
import budgets from './routes/budgets';
import investments from './routes/investments';
import plaidRoutes from './routes/plaid';
import importRoutes from './routes/import';
import spendingRoutes from './routes/spending';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin ?? 'http://localhost:5173',
  credentials: true,
}));

// Public — no auth required
app.route('/api/auth', authRoutes);

// Protected — requireAuth is applied inside each route file
app.route('/api/dashboard', dashboard);
app.route('/api/accounts', accounts);
app.route('/api/transactions', transactions);
app.route('/api/budgets', budgets);
app.route('/api/investments', investments);
app.route('/api/plaid', plaidRoutes);
app.route('/api/import', importRoutes);
app.route('/api/spending', spendingRoutes);

app.get('/', (c) => c.json({ status: 'ok', message: 'Personal Balance Tracker API' }));

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
