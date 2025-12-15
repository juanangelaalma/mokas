import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

// System account codes
const SYSTEM_ACCOUNTS = {
  AR: '1-1100',             // Piutang Usaha
  AP: '2-1001',             // Hutang Usaha
  INVENTORY: '1-1200',      // Persediaan Barang
  COGS: '5-1001',           // Harga Pokok Penjualan
  SALES_REVENUE: '4-1001',  // Pendapatan Penjualan
  SALES_RETURN: '4-1002',   // Retur Penjualan (contra revenue)
};

async function getAccountByCode(
  tx: Prisma.TransactionClient,
  tenantId: string,
  code: string
) {
  const accounts = await tx.account.findMany()
  const account = await tx.account.findFirst({
    where: { tenantId, code },
  });
  if (!account) {
    throw new Error(`Akun sistem ${code} tidak ditemukan. Harap hubungi administrator.`);
  }
  return account;
}

async function getNextJournalNumber(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const lastJournal = await tx.journalEntry.findFirst({
    where: { tenantId },
    orderBy: { entryNumber: 'desc' },
  });

  let sequence = 1;
  if (lastJournal?.entryNumber) {
    const match = lastJournal.entryNumber.match(/(\d+)$/);
    if (match) sequence = parseInt(match[1]) + 1;
  }

  const year = new Date().getFullYear();
  return `JRN-${year}-${String(sequence).padStart(5, '0')}`;
}

// ============================================
// PURCHASE JOURNALS
// ============================================

export async function generatePurchaseJournal(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    purchaseNumber: string;
    purchaseDate: Date;
    vendorName: string;
    totalAmount: Decimal;
    paymentType: 'CASH' | 'CREDIT';
    paymentAccountId?: string;
  }
): Promise<string> {
  const inventoryAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.INVENTORY);
  const apAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AP);
  const journalNumber = await getNextJournalNumber(tx, input.tenantId);

  const lines = [];

  // Debit: Persediaan
  lines.push({
    accountId: inventoryAccount.id,
    description: 'Persediaan masuk',
    debit: input.totalAmount,
    credit: new Decimal(0),
  });

  if (input.paymentType === 'CASH') {
    // Credit: Kas/Bank
    lines.push({
      accountId: input.paymentAccountId!,
      description: 'Pembayaran tunai',
      debit: new Decimal(0),
      credit: input.totalAmount,
    });
  } else {
    // Credit: Hutang Usaha
    lines.push({
      accountId: apAccount.id,
      description: 'Hutang usaha',
      debit: new Decimal(0),
      credit: input.totalAmount,
    });
  }

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: journalNumber,
      date: input.purchaseDate,
      description: `Pembelian ${input.paymentType === 'CASH' ? 'tunai' : 'kredit'} - ${input.purchaseNumber} - ${input.vendorName}`,
      isManual: false,
      lines: { create: lines },
    },
  });

  return journal.id;
}

export async function generatePurchasePaymentJournal(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    paymentNumber: string;
    paymentDate: Date;
    amount: Decimal;
    paymentAccountId: string;
    vendorName: string;
    purchaseNumber: string;
  }
): Promise<string> {
  const apAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AP);
  const journalNumber = await getNextJournalNumber(tx, input.tenantId);

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: journalNumber,
      date: input.paymentDate,
      description: `Pembayaran hutang - ${input.purchaseNumber} - ${input.vendorName}`,
      isManual: false,
      lines: {
        create: [
          {
            accountId: apAccount.id,
            description: 'Pelunasan hutang usaha',
            debit: input.amount,
            credit: new Decimal(0),
          },
          {
            accountId: input.paymentAccountId,
            description: 'Pembayaran kas/bank',
            debit: new Decimal(0),
            credit: input.amount,
          },
        ],
      },
    },
  });

  return journal.id;
}

export async function generatePurchaseReturnJournal(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    returnNumber: string;
    returnDate: Date;
    amount: Decimal;
    vendorName: string;
    purchaseNumber: string;
    refundType: 'CREDIT_NOTE' | 'CASH_REFUND';
    refundAccountId?: string;
  }
): Promise<string> {
  const inventoryAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.INVENTORY);
  const apAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AP);
  const journalNumber = await getNextJournalNumber(tx, input.tenantId);

  const lines = [];

  if (input.refundType === 'CREDIT_NOTE') {
    // Debit: Hutang Usaha (reduce)
    lines.push({
      accountId: apAccount.id,
      description: 'Pengurangan hutang (retur)',
      debit: input.amount,
      credit: new Decimal(0),
    });
  } else {
    // Debit: Kas/Bank (receive refund)
    lines.push({
      accountId: input.refundAccountId!,
      description: 'Penerimaan refund',
      debit: input.amount,
      credit: new Decimal(0),
    });
  }

  // Credit: Persediaan (reduce)
  lines.push({
    accountId: inventoryAccount.id,
    description: 'Persediaan keluar (retur)',
    debit: new Decimal(0),
    credit: input.amount,
  });

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: journalNumber,
      date: input.returnDate,
      description: `Retur pembelian - ${input.returnNumber} - ${input.vendorName}`,
      isManual: false,
      lines: { create: lines },
    },
  });

  return journal.id;
}

// ============================================
// SALES JOURNALS
// ============================================

export async function generateSaleJournals(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    saleNumber: string;
    saleDate: Date;
    customerName: string;
    totalAmount: Decimal;
    totalCogs: Decimal;
    paymentType: 'CASH' | 'CREDIT';
    paymentAccountId?: string;
    hasInventoryItems: boolean;
  }
): Promise<{ revenueJournalId: string; cogsJournalId: string | null }> {
  const arAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AR);
  const revenueAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.SALES_REVENUE);

  // JOURNAL 1: Revenue Recognition
  const revenueJournalNumber = await getNextJournalNumber(tx, input.tenantId);

  const revenueLines = [];

  if (input.paymentType === 'CASH') {
    // Debit: Kas/Bank
    revenueLines.push({
      accountId: input.paymentAccountId!,
      description: 'Penerimaan tunai',
      debit: input.totalAmount,
      credit: new Decimal(0),
    });
  } else {
    // Debit: Piutang Usaha
    revenueLines.push({
      accountId: arAccount.id,
      description: 'Piutang usaha',
      debit: input.totalAmount,
      credit: new Decimal(0),
    });
  }

  // Credit: Pendapatan Penjualan
  revenueLines.push({
    accountId: revenueAccount.id,
    description: 'Pendapatan penjualan',
    debit: new Decimal(0),
    credit: input.totalAmount,
  });

  const revenueJournal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: revenueJournalNumber,
      date: input.saleDate,
      description: `Penjualan ${input.paymentType === 'CASH' ? 'tunai' : 'kredit'} - ${input.saleNumber} - ${input.customerName}`,
      isManual: false,
      lines: { create: revenueLines },
    },
  });

  // JOURNAL 2: COGS Recognition (only if there are inventory items with COGS)
  let cogsJournalId: string | null = null;

  if (input.hasInventoryItems && input.totalCogs.greaterThan(0)) {
    const inventoryAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.INVENTORY);
    const cogsAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.COGS);
    const cogsJournalNumber = await getNextJournalNumber(tx, input.tenantId);

    const cogsJournal = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: cogsJournalNumber,
        date: input.saleDate,
        description: `HPP - ${input.saleNumber}`,
        isManual: false,
        lines: {
          create: [
            {
              accountId: cogsAccount.id,
              description: 'Harga pokok penjualan',
              debit: input.totalCogs,
              credit: new Decimal(0),
            },
            {
              accountId: inventoryAccount.id,
              description: 'Persediaan keluar',
              debit: new Decimal(0),
              credit: input.totalCogs,
            },
          ],
        },
      },
    });

    cogsJournalId = cogsJournal.id;
  }

  return { revenueJournalId: revenueJournal.id, cogsJournalId };
}

export async function generateSalePaymentJournal(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    paymentNumber: string;
    paymentDate: Date;
    amount: Decimal;
    paymentAccountId: string;
    customerName: string;
    saleNumber: string;
  }
): Promise<string> {
  const arAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AR);
  const journalNumber = await getNextJournalNumber(tx, input.tenantId);

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: journalNumber,
      date: input.paymentDate,
      description: `Penerimaan piutang - ${input.saleNumber} - ${input.customerName}`,
      isManual: false,
      lines: {
        create: [
          {
            accountId: input.paymentAccountId,
            description: 'Penerimaan kas/bank',
            debit: input.amount,
            credit: new Decimal(0),
          },
          {
            accountId: arAccount.id,
            description: 'Pelunasan piutang usaha',
            debit: new Decimal(0),
            credit: input.amount,
          },
        ],
      },
    },
  });

  return journal.id;
}

export async function generateSaleReturnJournals(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    returnNumber: string;
    returnDate: Date;
    amount: Decimal;
    cogsAmount: Decimal;
    customerName: string;
    saleNumber: string;
    refundType: 'CREDIT_NOTE' | 'CASH_REFUND';
    refundAccountId?: string;
    hasInventoryItems: boolean;
  }
): Promise<{ revenueJournalId: string; cogsJournalId: string | null }> {
  const arAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.AR);

  // Get or create sales return account
  let salesReturnAccount = await tx.account.findFirst({
    where: { tenantId: input.tenantId, code: SYSTEM_ACCOUNTS.SALES_RETURN },
  });

  if (!salesReturnAccount) {
    // Use regular revenue account if sales return account doesn't exist
    salesReturnAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.SALES_REVENUE);
  }

  // JOURNAL 1: Reverse Revenue
  const revenueJournalNumber = await getNextJournalNumber(tx, input.tenantId);

  const revenueLines = [];

  // Debit: Retur Penjualan (or Sales Revenue if using contra)
  revenueLines.push({
    accountId: salesReturnAccount.id,
    description: 'Retur penjualan',
    debit: input.amount,
    credit: new Decimal(0),
  });

  if (input.refundType === 'CREDIT_NOTE') {
    // Credit: Piutang Usaha (reduce AR)
    revenueLines.push({
      accountId: arAccount.id,
      description: 'Pengurangan piutang',
      debit: new Decimal(0),
      credit: input.amount,
    });
  } else {
    // Credit: Kas/Bank (cash refund)
    revenueLines.push({
      accountId: input.refundAccountId!,
      description: 'Pengembalian kas',
      debit: new Decimal(0),
      credit: input.amount,
    });
  }

  const revenueJournal = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId,
      entryNumber: revenueJournalNumber,
      date: input.returnDate,
      description: `Retur penjualan - ${input.returnNumber} - ${input.customerName}`,
      isManual: false,
      lines: { create: revenueLines },
    },
  });

  // JOURNAL 2: Reverse COGS & Restore Inventory
  let cogsJournalId: string | null = null;

  if (input.hasInventoryItems && input.cogsAmount.greaterThan(0)) {
    const inventoryAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.INVENTORY);
    const cogsAccount = await getAccountByCode(tx, input.tenantId, SYSTEM_ACCOUNTS.COGS);
    const cogsJournalNumber = await getNextJournalNumber(tx, input.tenantId);

    const cogsJournal = await tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        entryNumber: cogsJournalNumber,
        date: input.returnDate,
        description: `Pemulihan HPP - ${input.returnNumber}`,
        isManual: false,
        lines: {
          create: [
            {
              accountId: inventoryAccount.id,
              description: 'Persediaan masuk (retur)',
              debit: input.cogsAmount,
              credit: new Decimal(0),
            },
            {
              accountId: cogsAccount.id,
              description: 'Pemulihan HPP',
              debit: new Decimal(0),
              credit: input.cogsAmount,
            },
          ],
        },
      },
    });

    cogsJournalId = cogsJournal.id;
  }

  return { revenueJournalId: revenueJournal.id, cogsJournalId };
}
