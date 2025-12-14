import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { AccountType } from '@prisma/client';
import {
  calculateTrialBalance,
  calculateAccountBalance,
  groupAccountsByType,
  calculateProfitLoss,
} from '@/domain/accounting/ledger-calculator';
import { AccountWithBalance, TrialBalanceRow, ProfitLossReport, BalanceSheetReport, LedgerEntry } from '@/types';

export class ReportService {
  async getJournalReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    const journals = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
          },
        },
        transaction: {
          select: { transactionNumber: true, type: true },
        },
      },
      orderBy: [{ date: 'asc' }, { entryNumber: 'asc' }],
    });

    return journals.map((journal) => ({
      id: journal.id,
      entryNumber: journal.entryNumber,
      date: journal.date,
      description: journal.description,
      transactionNumber: journal.transaction?.transactionNumber,
      transactionType: journal.transaction?.type,
      lines: journal.lines.map((line) => ({
        accountCode: line.account.code,
        accountName: line.account.name,
        description: line.description,
        debit: new Decimal(line.debit.toString()).toNumber(),
        credit: new Decimal(line.credit.toString()).toNumber(),
      })),
    }));
  }

  async getLedger(
    tenantId: string,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ account: any; entries: LedgerEntry[] }> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) throw new Error('Akun tidak ditemukan');

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          tenantId,
          date: { gte: startDate, lte: endDate },
        },
      },
      include: {
        journalEntry: {
          select: { date: true, description: true, entryNumber: true },
        },
      },
      orderBy: {
        journalEntry: { date: 'asc' },
      },
    });

    const entries = calculateAccountBalance(lines, account.normalBalance);

    return { account, entries };
  }

  async getTrialBalance(
    tenantId: string,
    asOfDate: Date
  ): Promise<{ accounts: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
      include: {
        lines: {
          where: {
            journalEntry: {
              date: { lte: asOfDate },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const balances = calculateTrialBalance(accounts);

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const rows: TrialBalanceRow[] = balances
      .filter((b) => b.debit !== 0 || b.credit !== 0)
      .map((b) => {
        let debitBalance = 0;
        let creditBalance = 0;

        if (b.normalBalance === 'DEBIT') {
          if (b.balance >= 0) {
            debitBalance = b.balance;
          } else {
            creditBalance = Math.abs(b.balance);
          }
        } else {
          if (b.balance >= 0) {
            creditBalance = b.balance;
          } else {
            debitBalance = Math.abs(b.balance);
          }
        }

        totalDebit = totalDebit.add(debitBalance);
        totalCredit = totalCredit.add(creditBalance);

        return {
          accountId: b.id,
          accountCode: b.code,
          accountName: b.name,
          accountType: b.type,
          debit: debitBalance,
          credit: creditBalance,
        };
      });

    return {
      accounts: rows,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
    };
  }

  async getProfitLoss(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProfitLossReport> {
    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      include: {
        lines: {
          where: {
            journalEntry: {
              date: { gte: startDate, lte: endDate },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const balances = calculateTrialBalance(accounts);
    const grouped = groupAccountsByType(balances);
    const { totalRevenue, totalExpense, netIncome } = calculateProfitLoss(balances);

    return {
      period: { start: startDate, end: endDate },
      revenue: {
        accounts: grouped.REVENUE,
        total: totalRevenue,
      },
      expenses: {
        accounts: grouped.EXPENSE,
        total: totalExpense,
      },
      netIncome,
    };
  }

  async getBalanceSheet(
    tenantId: string,
    asOfDate: Date
  ): Promise<BalanceSheetReport> {
    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
      },
      include: {
        lines: {
          where: {
            journalEntry: {
              date: { lte: asOfDate },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    const plAccounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      include: {
        lines: {
          where: {
            journalEntry: {
              date: { lte: asOfDate },
            },
          },
        },
      },
    });

    const plBalances = calculateTrialBalance(plAccounts);
    const { netIncome } = calculateProfitLoss(plBalances);

    const balances = calculateTrialBalance(accounts);
    const grouped = groupAccountsByType(balances);

    const totalAssets = grouped.ASSET.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = grouped.LIABILITY.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = grouped.EQUITY.reduce((sum, a) => sum + a.balance, 0) + netIncome;

    if (netIncome !== 0) {
      grouped.EQUITY.push({
        id: 'current-period-net-income',
        code: '3-9999',
        name: 'Laba/Rugi Periode Berjalan',
        type: 'EQUITY' as AccountType,
        normalBalance: 'CREDIT',
        debit: netIncome < 0 ? Math.abs(netIncome) : 0,
        credit: netIncome > 0 ? netIncome : 0,
        balance: netIncome,
      });
    }

    return {
      asOf: asOfDate,
      assets: {
        accounts: grouped.ASSET,
        total: totalAssets,
      },
      liabilities: {
        accounts: grouped.LIABILITY,
        total: totalLiabilities,
      },
      equity: {
        accounts: grouped.EQUITY,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    };
  }
}

export const reportService = new ReportService();
