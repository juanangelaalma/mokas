import { TransactionType, Account, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

export interface JournalLineInput {
  accountId: string;
  description?: string;
  debit: Decimal;
  credit: Decimal;
}

export interface GenerateJournalInput {
  transactionType: TransactionType;
  amount: Decimal;
  paymentAccountId: string;
  categoryAccountId: string;
  description: string;
  systemAccounts: {
    receivable: string;
    payable: string;
  };
}

export interface JournalTemplate {
  lines: {
    accountSource: 'payment' | 'category' | 'receivable' | 'payable';
    position: 'DEBIT' | 'CREDIT';
  }[];
}

const JOURNAL_TEMPLATES: Record<TransactionType, JournalTemplate> = {
  CASH_IN: {
    lines: [
      { accountSource: 'payment', position: 'DEBIT' },
      { accountSource: 'category', position: 'CREDIT' },
    ],
  },
  CASH_OUT: {
    lines: [
      { accountSource: 'category', position: 'DEBIT' },
      { accountSource: 'payment', position: 'CREDIT' },
    ],
  },
  BANK_IN: {
    lines: [
      { accountSource: 'payment', position: 'DEBIT' },
      { accountSource: 'category', position: 'CREDIT' },
    ],
  },
  BANK_OUT: {
    lines: [
      { accountSource: 'category', position: 'DEBIT' },
      { accountSource: 'payment', position: 'CREDIT' },
    ],
  },
  RECEIVABLE: {
    lines: [
      { accountSource: 'receivable', position: 'DEBIT' },
      { accountSource: 'category', position: 'CREDIT' },
    ],
  },
  RECEIVABLE_PAYMENT: {
    lines: [
      { accountSource: 'payment', position: 'DEBIT' },
      { accountSource: 'receivable', position: 'CREDIT' },
    ],
  },
  PAYABLE: {
    lines: [
      { accountSource: 'category', position: 'DEBIT' },
      { accountSource: 'payable', position: 'CREDIT' },
    ],
  },
  PAYABLE_PAYMENT: {
    lines: [
      { accountSource: 'payable', position: 'DEBIT' },
      { accountSource: 'payment', position: 'CREDIT' },
    ],
  },
  TRANSFER: {
    lines: [
      { accountSource: 'category', position: 'DEBIT' },
      { accountSource: 'payment', position: 'CREDIT' },
    ],
  },
};

export function generateJournalLines(input: GenerateJournalInput): JournalLineInput[] {
  const template = JOURNAL_TEMPLATES[input.transactionType];
  if (!template) {
    throw new Error(`Unknown transaction type: ${input.transactionType}`);
  }

  const lines: JournalLineInput[] = [];

  for (const lineTemplate of template.lines) {
    let accountId: string;

    switch (lineTemplate.accountSource) {
      case 'payment':
        accountId = input.paymentAccountId;
        break;
      case 'category':
        accountId = input.categoryAccountId;
        break;
      case 'receivable':
        accountId = input.systemAccounts.receivable;
        break;
      case 'payable':
        accountId = input.systemAccounts.payable;
        break;
      default:
        throw new Error(`Unknown account source: ${lineTemplate.accountSource}`);
    }

    lines.push({
      accountId,
      description: input.description,
      debit: lineTemplate.position === 'DEBIT' ? input.amount : new Decimal(0),
      credit: lineTemplate.position === 'CREDIT' ? input.amount : new Decimal(0),
    });
  }

  return lines;
}

export function validateJournalBalance(lines: JournalLineInput[]): void {
  const totalDebit = lines.reduce((sum, line) => sum.add(line.debit), new Decimal(0));
  const totalCredit = lines.reduce((sum, line) => sum.add(line.credit), new Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(
      `Journal must balance. Debit: ${totalDebit.toString()}, Credit: ${totalCredit.toString()}`
    );
  }
}

export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    CASH_IN: 'Pemasukan Tunai',
    CASH_OUT: 'Pengeluaran Tunai',
    BANK_IN: 'Pemasukan Bank',
    BANK_OUT: 'Pengeluaran Bank',
    RECEIVABLE: 'Penjualan Kredit',
    RECEIVABLE_PAYMENT: 'Terima Pembayaran Piutang',
    PAYABLE: 'Pembelian Kredit',
    PAYABLE_PAYMENT: 'Bayar Hutang',
    TRANSFER: 'Transfer',
  };
  return labels[type] || type;
}
