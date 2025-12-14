import Decimal from 'decimal.js';
import prisma from '@/lib/prisma';

export interface CreditLimitValidation {
  valid: boolean;
  message?: string;
  creditLimit: Decimal;
  currentOutstanding: Decimal;
  availableCredit: Decimal;
}

export interface StockValidation {
  valid: boolean;
  productId: string;
  productName: string;
  requested: number;
  available: number;
  message?: string;
}

export interface ReturnValidation {
  valid: boolean;
  message?: string;
}

/**
 * Validate credit limit before creating credit sale
 */
export async function validateCreditLimit(
  tenantId: string,
  contactId: string,
  newSaleAmount: Decimal
): Promise<CreditLimitValidation> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });

  if (!contact) {
    return {
      valid: false,
      message: 'Pelanggan tidak ditemukan',
      creditLimit: new Decimal(0),
      currentOutstanding: new Decimal(0),
      availableCredit: new Decimal(0),
    };
  }

  const creditLimit = new Decimal(contact.creditLimit.toString());

  // If credit limit is 0, no limit applied (unlimited)
  if (creditLimit.equals(0)) {
    return {
      valid: true,
      creditLimit,
      currentOutstanding: new Decimal(0),
      availableCredit: creditLimit,
    };
  }

  // Calculate current outstanding AR
  const outstandingAR = await prisma.sale.aggregate({
    where: {
      tenantId,
      contactId,
      status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
    },
    _sum: {
      totalAmount: true,
      paidAmount: true,
    },
  });

  const currentOutstanding = new Decimal(outstandingAR._sum.totalAmount?.toString() || '0')
    .sub(outstandingAR._sum.paidAmount?.toString() || '0');

  const availableCredit = creditLimit.sub(currentOutstanding);

  if (newSaleAmount.greaterThan(availableCredit)) {
    return {
      valid: false,
      message: `Kredit limit terlampaui. Tersedia: ${availableCredit.toFixed(0)}, Diminta: ${newSaleAmount.toFixed(0)}`,
      creditLimit,
      currentOutstanding,
      availableCredit,
    };
  }

  return {
    valid: true,
    creditLimit,
    currentOutstanding,
    availableCredit,
  };
}

/**
 * Validate stock availability for sale items
 */
export async function validateStockAvailability(
  tenantId: string,
  items: { productId: string; quantity: number }[]
): Promise<StockValidation[]> {
  const results: StockValidation[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) {
      results.push({
        valid: false,
        productId: item.productId,
        productName: 'Unknown',
        requested: item.quantity,
        available: 0,
        message: 'Produk tidak ditemukan',
      });
      continue;
    }

    // Service products don't need stock validation
    if (product.type === 'SERVICE') {
      results.push({
        valid: true,
        productId: item.productId,
        productName: product.name,
        requested: item.quantity,
        available: -1, // -1 indicates unlimited (service)
      });
      continue;
    }

    // Calculate available stock from inventory layers
    const availableStock = await prisma.inventoryLayer.aggregate({
      where: {
        tenantId,
        productId: item.productId,
        remainingQty: { gt: 0 },
      },
      _sum: {
        remainingQty: true,
      },
    });

    const available = availableStock._sum.remainingQty || 0;

    results.push({
      valid: available >= item.quantity,
      productId: item.productId,
      productName: product.name,
      requested: item.quantity,
      available,
      message: available < item.quantity
        ? `Stok tidak cukup: tersedia ${available}, diminta ${item.quantity}`
        : undefined,
    });
  }

  return results;
}

/**
 * Validate sale return quantity
 */
export function validateSaleReturn(
  originalQty: number,
  alreadyReturnedQty: number,
  returnQty: number
): ReturnValidation {
  const maxReturnable = originalQty - alreadyReturnedQty;

  if (returnQty <= 0) {
    return { valid: false, message: 'Jumlah retur harus lebih dari 0' };
  }

  if (returnQty > maxReturnable) {
    return {
      valid: false,
      message: `Tidak dapat meretur ${returnQty}. Maksimal: ${maxReturnable}`,
    };
  }

  return { valid: true };
}

/**
 * Validate purchase return quantity
 */
export function validatePurchaseReturn(
  originalQty: number,
  alreadyReturnedQty: number,
  returnQty: number,
  inventoryLayerRemainingQty: number
): ReturnValidation {
  const maxReturnable = originalQty - alreadyReturnedQty;

  if (returnQty <= 0) {
    return { valid: false, message: 'Jumlah retur harus lebih dari 0' };
  }

  if (returnQty > maxReturnable) {
    return {
      valid: false,
      message: `Tidak dapat meretur ${returnQty}. Maksimal dari pembelian: ${maxReturnable}`,
    };
  }

  if (returnQty > inventoryLayerRemainingQty) {
    return {
      valid: false,
      message: `Tidak dapat meretur ${returnQty}. Hanya ${inventoryLayerRemainingQty} tersisa di persediaan (sebagian mungkin sudah terjual)`,
    };
  }

  return { valid: true };
}
