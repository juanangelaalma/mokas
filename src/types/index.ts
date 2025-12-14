import { Role, AccountType, NormalBalance, TransactionType, TransactionStatus, ContactType } from '@prisma/client';

export type { Role, AccountType, NormalBalance, TransactionType, TransactionStatus, ContactType };

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerEntry {
  date: Date;
  description: string;
  journalNumber: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
}

export interface ProfitLossReport {
  period: { start: Date; end: Date };
  revenue: { accounts: AccountWithBalance[]; total: number };
  expenses: { accounts: AccountWithBalance[]; total: number };
  netIncome: number;
}

export interface BalanceSheetReport {
  asOf: Date;
  assets: { accounts: AccountWithBalance[]; total: number };
  liabilities: { accounts: AccountWithBalance[]; total: number };
  equity: { accounts: AccountWithBalance[]; total: number };
  totalLiabilitiesAndEquity: number;
}
