import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { CreateTransactionInput } from '@/schemas/transaction.schema';
import { generateJournalLines, validateJournalBalance } from '@/domain/accounting/journal-generator';
import { validateAccountTypeForTransaction, validateAmount } from '@/domain/accounting/validators';
import { generateTransactionNumber } from '@/lib/utils';
import { accountService } from './account-service';

export class TransactionService {
  async getAll(tenantId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = { tenantId };

    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }

    if (options?.type) where.type = options.type;
    if (options?.status) where.status = options.status;

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          paymentAccount: { select: { id: true, code: true, name: true } },
          categoryAccount: { select: { id: true, code: true, name: true } },
          contact: { select: { id: true, name: true } },
          journalEntry: { select: { id: true, entryNumber: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(tenantId: string, id: string) {
    return prisma.transaction.findFirst({
      where: { id, tenantId },
      include: {
        paymentAccount: true,
        categoryAccount: true,
        contact: true,
        journalEntry: {
          include: {
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  async create(tenantId: string, input: CreateTransactionInput, userId?: string) {
    const amount = validateAmount(input.amount);

    const [paymentAccount, categoryAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: input.paymentAccountId, tenantId } }),
      prisma.account.findFirst({ where: { id: input.categoryAccountId, tenantId } }),
    ]);

    if (!paymentAccount) throw new Error('Akun pembayaran tidak ditemukan');
    if (!categoryAccount) throw new Error('Akun kategori tidak ditemukan');

    validateAccountTypeForTransaction(
      input.type,
      paymentAccount.type,
      categoryAccount.type
    );

    const systemAccounts = await accountService.getSystemAccounts(tenantId);

    const journalLines = generateJournalLines({
      transactionType: input.type,
      amount,
      paymentAccountId: input.paymentAccountId,
      categoryAccountId: input.categoryAccountId,
      description: input.description,
      systemAccounts,
    });

    validateJournalBalance(journalLines);

    const lastTransaction = await prisma.transaction.findFirst({
      where: { tenantId },
      orderBy: { transactionNumber: 'desc' },
    });

    let sequence = 1;
    if (lastTransaction?.transactionNumber) {
      const match = lastTransaction.transactionNumber.match(/(\d+)$/);
      if (match) sequence = parseInt(match[1]) + 1;
    }

    const transactionNumber = generateTransactionNumber('TRX', sequence);

    const lastJournal = await prisma.journalEntry.findFirst({
      where: { tenantId },
      orderBy: { entryNumber: 'desc' },
    });

    let journalSequence = 1;
    if (lastJournal?.entryNumber) {
      const match = lastJournal.entryNumber.match(/(\d+)$/);
      if (match) journalSequence = parseInt(match[1]) + 1;
    }

    const entryNumber = generateTransactionNumber('JRN', journalSequence);

    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId,
          transactionNumber,
          date: input.date,
          type: input.type,
          description: input.description,
          amount,
          paymentAccountId: input.paymentAccountId,
          categoryAccountId: input.categoryAccountId,
          contactId: input.contactId,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          status: 'POSTED',
          createdBy: userId,
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          transactionId: transaction.id,
          date: input.date,
          description: input.description,
          isManual: false,
          createdBy: userId,
          lines: {
            create: journalLines.map((line) => ({
              accountId: line.accountId,
              description: line.description,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return { transaction, journalEntry };
    });
  }

  async void(tenantId: string, id: string, userId?: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, tenantId },
      include: { journalEntry: true },
    });

    if (!transaction) throw new Error('Transaksi tidak ditemukan');
    if (transaction.status === 'VOID') throw new Error('Transaksi sudah dibatalkan');

    return prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data: { status: 'VOID' },
      });

      if (transaction.journalEntry) {
        await tx.journalLine.deleteMany({
          where: { journalEntryId: transaction.journalEntry.id },
        });

        await tx.journalEntry.delete({
          where: { id: transaction.journalEntry.id },
        });
      }

      return { success: true };
    });
  }

  async getSummary(tenantId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        status: 'POSTED',
      },
      select: {
        type: true,
        amount: true,
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);

    for (const t of transactions) {
      const amount = new Decimal(t.amount.toString());
      if (['CASH_IN', 'BANK_IN', 'RECEIVABLE'].includes(t.type)) {
        totalIncome = totalIncome.add(amount);
      } else if (['CASH_OUT', 'BANK_OUT', 'PAYABLE'].includes(t.type)) {
        totalExpense = totalExpense.add(amount);
      }
    }

    return {
      totalIncome: totalIncome.toNumber(),
      totalExpense: totalExpense.toNumber(),
      netIncome: totalIncome.sub(totalExpense).toNumber(),
      transactionCount: transactions.length,
    };
  }
}

export const transactionService = new TransactionService();
