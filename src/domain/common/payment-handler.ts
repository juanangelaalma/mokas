import Decimal from 'decimal.js';
import { addDays, differenceInDays, isAfter } from 'date-fns';

export interface PaymentValidation {
  valid: boolean;
  message?: string;
  remainingBefore: Decimal;
  remainingAfter: Decimal;
  newStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
}

/**
 * Calculate due date from transaction date and payment terms
 */
export function calculateDueDate(
  transactionDate: Date,
  paymentTermDays: number
): Date {
  if (paymentTermDays <= 0) {
    return transactionDate;
  }
  return addDays(transactionDate, paymentTermDays);
}

/**
 * Check if a document is overdue
 */
export function isOverdue(dueDate: Date, currentDate: Date = new Date()): boolean {
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return isAfter(currentDate, due);
}

/**
 * Get number of days overdue
 */
export function getDaysOverdue(dueDate: Date, currentDate: Date = new Date()): number {
  if (!isOverdue(dueDate, currentDate)) return 0;
  return differenceInDays(currentDate, new Date(dueDate));
}

/**
 * Validate payment amount
 */
export function validatePayment(
  totalAmount: Decimal,
  currentPaidAmount: Decimal,
  paymentAmount: Decimal
): PaymentValidation {
  const remainingBefore = totalAmount.sub(currentPaidAmount);

  // Cannot pay more than remaining
  if (paymentAmount.greaterThan(remainingBefore)) {
    return {
      valid: false,
      message: `Jumlah pembayaran (${paymentAmount.toFixed(0)}) melebihi sisa tagihan (${remainingBefore.toFixed(0)})`,
      remainingBefore,
      remainingAfter: remainingBefore,
      newStatus: currentPaidAmount.equals(0) ? 'UNPAID' : 'PARTIAL',
    };
  }

  // Cannot pay zero or negative
  if (paymentAmount.lessThanOrEqualTo(0)) {
    return {
      valid: false,
      message: 'Jumlah pembayaran harus lebih dari 0',
      remainingBefore,
      remainingAfter: remainingBefore,
      newStatus: currentPaidAmount.equals(0) ? 'UNPAID' : 'PARTIAL',
    };
  }

  const newPaidAmount = currentPaidAmount.add(paymentAmount);
  const remainingAfter = totalAmount.sub(newPaidAmount);

  let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  if (remainingAfter.lessThanOrEqualTo(0)) {
    newStatus = 'PAID';
  } else if (newPaidAmount.greaterThan(0)) {
    newStatus = 'PARTIAL';
  } else {
    newStatus = 'UNPAID';
  }

  return {
    valid: true,
    remainingBefore,
    remainingAfter,
    newStatus,
  };
}

/**
 * Calculate new status after return
 */
export function calculateStatusAfterReturn(
  originalTotal: Decimal,
  returnAmount: Decimal,
  paidAmount: Decimal
): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const newTotal = originalTotal.sub(returnAmount);
  
  if (newTotal.lessThanOrEqualTo(0)) {
    return 'PAID';
  }

  if (paidAmount.greaterThanOrEqualTo(newTotal)) {
    return 'PAID';
  }

  if (paidAmount.greaterThan(0)) {
    return 'PARTIAL';
  }

  return 'UNPAID';
}

/**
 * Determine refund amount needed after return
 * Returns positive value if customer/vendor should get money back
 */
export function calculateRefundNeeded(
  originalTotal: Decimal,
  returnAmount: Decimal,
  paidAmount: Decimal
): Decimal {
  const newTotal = originalTotal.sub(returnAmount);
  const overpaid = paidAmount.sub(newTotal);

  if (overpaid.greaterThan(0)) {
    return overpaid;
  }

  return new Decimal(0);
}
