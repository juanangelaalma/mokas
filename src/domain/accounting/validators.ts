import { AccountType, TransactionType, NormalBalance } from '@prisma/client';
import Decimal from 'decimal.js';

export class AccountingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingValidationError';
  }
}

export function validateAccountTypeForTransaction(
  transactionType: TransactionType,
  paymentAccountType: AccountType,
  categoryAccountType: AccountType
): void {
  if (paymentAccountType !== 'ASSET') {
    throw new AccountingValidationError(
      'Akun pembayaran harus berupa akun Aset (Kas/Bank)'
    );
  }

  const incomeTypes: TransactionType[] = ['CASH_IN', 'BANK_IN', 'RECEIVABLE'];
  const expenseTypes: TransactionType[] = ['CASH_OUT', 'BANK_OUT', 'PAYABLE'];

  if (incomeTypes.includes(transactionType)) {
    if (categoryAccountType !== 'REVENUE') {
      throw new AccountingValidationError(
        'Transaksi pemasukan harus menggunakan akun Pendapatan'
      );
    }
  }

  if (expenseTypes.includes(transactionType)) {
    if (categoryAccountType !== 'EXPENSE' && categoryAccountType !== 'ASSET') {
      throw new AccountingValidationError(
        'Transaksi pengeluaran harus menggunakan akun Beban atau Aset (Persediaan)'
      );
    }
  }

  if (transactionType === 'TRANSFER') {
    if (categoryAccountType !== 'ASSET') {
      throw new AccountingValidationError(
        'Transfer harus ke akun Aset (Kas/Bank lain)'
      );
    }
  }
}

export function validateAmount(amount: Decimal | number | string): Decimal {
  const decimal = new Decimal(amount.toString());
  
  if (decimal.lessThanOrEqualTo(0)) {
    throw new AccountingValidationError('Jumlah harus lebih dari 0');
  }

  if (decimal.decimalPlaces() > 2) {
    throw new AccountingValidationError('Jumlah maksimal 2 angka desimal');
  }

  return decimal;
}

export function validateAccountCode(code: string): void {
  const pattern = /^[0-9]-[0-9]{4}$/;
  if (!pattern.test(code)) {
    throw new AccountingValidationError(
      'Format kode akun tidak valid. Gunakan format: X-XXXX (contoh: 1-1001)'
    );
  }
}

export function getExpectedNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case 'ASSET':
    case 'EXPENSE':
      return 'DEBIT';
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
      return 'CREDIT';
    default:
      throw new AccountingValidationError(`Unknown account type: ${type}`);
  }
}

export function validateSystemAccountNotDeleted(isSystem: boolean): void {
  if (isSystem) {
    throw new AccountingValidationError(
      'Akun sistem tidak dapat dihapus'
    );
  }
}

export function validateAccountHasNoTransactions(transactionCount: number): void {
  if (transactionCount > 0) {
    throw new AccountingValidationError(
      'Akun tidak dapat dihapus karena sudah memiliki transaksi'
    );
  }
}
