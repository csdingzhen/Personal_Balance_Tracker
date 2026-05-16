# Personal Balance Tracker

A personal finance dashboard similar to Origin Financial, built with React + Hono + Prisma + SQLite.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Hono, TypeScript, tsx |
| Database | SQLite via Prisma 7 + better-sqlite3 |
| Account linking | Plaid Node SDK (Sandbox) |
| Shared types | `/shared/types.ts` (imported by both) |

## Environment Setup

### Root `.env` (Plaid credentials — already created)
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

### `backend/.env` (database + port — already created)
```
DATABASE_URL="file:./prisma/dev.db"
PORT=3001
```

## First-time Setup

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Run Prisma migration (creates the SQLite database)
npx prisma migrate dev

# 3. Seed with dummy data (BOA, SoFi, Moomoo accounts + 45 transactions)
npm run seed

# 4. Install frontend dependencies
cd ../frontend
npm install
```

## Running the App

Open **two terminals** from the project root:

**Terminal 1 — Backend**
```bash
npm run dev:backend
# → http://localhost:3001
```

**Terminal 2 — Frontend**
```bash
npm run dev:frontend
# → http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Net worth overview, area chart, account summary, recent transactions |
| Accounts | `/accounts` | All accounts grouped by institution with balances |
| Transactions | `/transactions` | Full transaction list with search, filters, date range, pagination |
| Budget | `/budget` | Monthly category budgets with progress bars |
| Investments | `/investments` | Holdings table, allocation donut chart, 30-day performance chart |
| Import CSV | `/import` | Drag & drop CSV upload with preview for Moomoo |
| Link Account | `/link` | Plaid Link integration for BOA and SoFi |

## Seed Data

The seed creates:
- **3 institutions**: Bank of America, SoFi, Moomoo
- **8 accounts**: BOA (checking, savings, credit), SoFi (checking, savings, credit, invest), Moomoo (brokerage)
- **45 transactions** across March–May 2026
- **8 budget categories** for May 2026
- **9 investment holdings**: VTI, VXUS, BND (SoFi) + AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL (Moomoo)

To re-seed from scratch:
```bash
npm run seed --prefix backend
```

## Useful Commands

```bash
# Prisma Studio (visual DB browser)
cd backend && npx prisma studio

# Reset DB and re-seed
cd backend && npm run db:reset && npm run seed
```

## Plaid Sandbox Test Credentials

When the Plaid Link modal opens (sandbox mode), use:
- **Username**: `user_good`
- **Password**: `pass_good`
- Choose any institution (select "Chase", "Bank of America", etc.)
