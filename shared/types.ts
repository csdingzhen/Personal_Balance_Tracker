export type AccountType = 'checking' | 'savings' | 'credit' | 'investment';

export interface Institution {
  id: string;
  name: string;
  logo: string | null;
  lastSynced: string | null;
}

export interface Account {
  id: string;
  institutionId: string;
  institution?: Institution;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  plaidAccountId?: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  account?: Pick<Account, 'id' | 'name' | 'type'>;
  amount: number;
  category: string | null;
  merchantName: string | null;
  date: string;
  pending: boolean;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpend: number;
  month: number;
  year: number;
}

export interface Investment {
  id: string;
  accountId: string;
  account?: Pick<Account, 'id' | 'name'>;
  ticker: string;
  name: string;
  shares: number;
  currentPrice: number;
  costBasis: number;
}

export interface NetWorthPoint {
  date: string;
  value: number;
}

export interface InstitutionGroup {
  institution: Institution;
  accounts: Account[];
  total: number;
}

export interface DashboardData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  history: NetWorthPoint[];
  accountsByInstitution: InstitutionGroup[];
  recentTransactions: Transaction[];
}

export interface InvestmentSummary {
  holdings: Investment[];
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  performanceHistory: { date: string; value: number }[];
}

export interface CSVPreviewRow {
  date: string;
  merchantName: string;
  amount: number;
  category: string;
}
