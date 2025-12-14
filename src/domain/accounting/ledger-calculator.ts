import { AccountType, NormalBalance } from '@prisma/client';
import Decimal from 'decimal.js';
import { AccountWithBalance, LedgerEntry } from '@/types';

export interface JournalLineWithAccount {
  debit: Decimal | number | string;
  credit: Decimal | number | string;
  journalEntry: {
    date: Date;
    description: string;
    entryNumber: string;
  };
}

export function calculateAccountBalance(
  lines: JournalLineWithAccount[],
  normalBalance: NormalBalance,
  openingBalance: Decimal = new Decimal(0)
): LedgerEntry[] {
  let runningBalance = openingBalance;
  const entries: LedgerEntry[] = [];

  for (const line of lines) {
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    if (normalBalance === 'DEBIT') {
      runningBalance = runningBalance.add(debit).sub(credit);
    } else {
      runningBalance = runningBalance.add(credit).sub(debit);
    }

    entries.push({
      date: line.journalEntry.date,
      description: line.journalEntry.description,
      journalNumber: line.journalEntry.entryNumber,
      debit: debit.toNumber(),
      credit: credit.toNumber(),
      balance: runningBalance.toNumber(),
    });
  }

  return entries;
}

export function calculateTrialBalance(
  accounts: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: NormalBalance;
    lines: { debit: Decimal | number | string; credit: Decimal | number | string }[];
  }[]
): AccountWithBalance[] {
  return accounts.map((account) => {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of account.lines) {
      totalDebit = totalDebit.add(new Decimal(line.debit.toString()));
      totalCredit = totalCredit.add(new Decimal(line.credit.toString()));
    }

    let balance: Decimal;
    if (account.normalBalance === 'DEBIT') {
      balance = totalDebit.sub(totalCredit);
    } else {
      balance = totalCredit.sub(totalDebit);
    }

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      debit: totalDebit.toNumber(),
      credit: totalCredit.toNumber(),
      balance: balance.toNumber(),
    };
  });
}

export function validateTrialBalanceTotals(accounts: AccountWithBalance[]): {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const account of accounts) {
    if (account.balance > 0) {
      if (account.normalBalance === 'DEBIT') {
        totalDebit = totalDebit.add(account.balance);
      } else {
        totalCredit = totalCredit.add(account.balance);
      }
    } else if (account.balance < 0) {
      if (account.normalBalance === 'DEBIT') {
        totalCredit = totalCredit.add(Math.abs(account.balance));
      } else {
        totalDebit = totalDebit.add(Math.abs(account.balance));
      }
    }
  }

  const difference = totalDebit.sub(totalCredit).abs();

  return {
    isBalanced: difference.lessThan(0.01),
    totalDebit: totalDebit.toNumber(),
    totalCredit: totalCredit.toNumber(),
    difference: difference.toNumber(),
  };
}

export function groupAccountsByType(accounts: AccountWithBalance[]): Record<AccountType, AccountWithBalance[]> {
  const grouped: Record<AccountType, AccountWithBalance[]> = {
    ASSET: [],
    LIABILITY: [],
    EQUITY: [],
    REVENUE: [],
    EXPENSE: [],
  };

  for (const account of accounts) {
    grouped[account.type].push(account);
  }

  return grouped;
}

export function calculateProfitLoss(accounts: AccountWithBalance[]): {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
} {
  let totalRevenue = new Decimal(0);
  let totalExpense = new Decimal(0);

  for (const account of accounts) {
    if (account.type === 'REVENUE') {
      totalRevenue = totalRevenue.add(account.balance);
    } else if (account.type === 'EXPENSE') {
      totalExpense = totalExpense.add(account.balance);
    }
  }

  return {
    totalRevenue: totalRevenue.toNumber(),
    totalExpense: totalExpense.toNumber(),
    netIncome: totalRevenue.sub(totalExpense).toNumber(),
  };
}
