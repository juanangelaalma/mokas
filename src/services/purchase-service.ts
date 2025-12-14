import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { CreatePurchaseInput, CreatePurchasePaymentInput, CreatePurchaseReturnInput } from '@/schemas/purchase.schema';
import { createInventoryLayer, reduceInventoryLayer } from '@/domain/inventory/fifo-engine';
import { generatePurchaseJournal, generatePurchasePaymentJournal, generatePurchaseReturnJournal } from './business-journal-service';
import { calculateDueDate, validatePayment } from '@/domain/common/payment-handler';
import { validatePurchaseReturn } from '@/domain/sales/validators';

export class PurchaseService {
  // ============================================
  // QUERIES
  // ============================================

  async getAll(tenantId: string, options?: {
    status?: string;
    contactId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = { tenantId };

    if (options?.status) where.status = options.status;
    if (options?.contactId) where.contactId = options.contactId;
    if (options?.startDate || options?.endDate) {
      where.purchaseDate = {};
      if (options.startDate) where.purchaseDate.gte = options.startDate;
      if (options.endDate) where.purchaseDate.lte = options.endDate;
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          contact: { select: { id: true, code: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchase.count({ where }),
    ]);

    return { data: purchases, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(tenantId: string, id: string) {
    return prisma.purchase.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        items: {
          include: {
            product: true,
            inventoryLayer: true,
            returnItems: true,
          },
        },
        payments: { include: { paymentAccount: true } },
        returns: { include: { items: true } },
        journalEntry: { include: { lines: { include: { account: true } } } },
      },
    });
  }

  // ============================================
  // CREATE PURCHASE
  // ============================================

  async create(tenantId: string, input: CreatePurchaseInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get vendor info
      const vendor = await tx.contact.findUnique({
        where: { id: input.contactId },
      });
      if (!vendor) throw new Error('Supplier tidak ditemukan');
      if (vendor.type === 'CUSTOMER') throw new Error('Kontak bukan supplier');

      // 2. Calculate amounts
      let subtotal = new Decimal(0);
      for (const item of input.items) {
        subtotal = subtotal.add(new Decimal(item.unitCost).mul(item.quantity));
      }
      const discountAmount = new Decimal(input.discountAmount || 0);
      const taxAmount = new Decimal(input.taxAmount || 0);
      const totalAmount = subtotal.sub(discountAmount).add(taxAmount);

      // 3. Calculate due date
      const dueDate = input.paymentType === 'CASH'
        ? input.purchaseDate
        : calculateDueDate(input.purchaseDate, vendor.paymentTermDays);

      // 4. Generate purchase number
      const purchaseNumber = await this.getNextPurchaseNumber(tx, tenantId);

      // 5. Create purchase record
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          purchaseNumber,
          contactId: input.contactId,
          purchaseDate: input.purchaseDate,
          dueDate,
          paymentType: input.paymentType,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: input.paymentType === 'CASH' ? totalAmount : 0,
          status: input.paymentType === 'CASH' ? 'PAID' : 'UNPAID',
          notes: input.notes || null,
          createdBy: userId,
        },
      });

      // 6. Create purchase items & inventory layers
      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) throw new Error(`Produk tidak ditemukan`);

        const itemAmount = new Decimal(item.unitCost).mul(item.quantity);

        // Create purchase item
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            description: item.description || product.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
            amount: itemAmount,
          },
        });

        // Create inventory layer for INVENTORY products
        if (product.type === 'INVENTORY') {
          const layerId = await createInventoryLayer(tx, {
            tenantId,
            productId: item.productId,
            sourceType: 'PURCHASE',
            sourceId: purchaseItem.id,
            quantity: item.quantity,
            unitCost: new Decimal(item.unitCost),
            receivedDate: input.purchaseDate,
          });

          // Link layer to purchase item
          await tx.purchaseItem.update({
            where: { id: purchaseItem.id },
            data: { inventoryLayerId: layerId },
          });
        }
      }

      // 7. Generate journal entry
      const journalId = await generatePurchaseJournal(tx, {
        tenantId,
        purchaseNumber,
        purchaseDate: input.purchaseDate,
        vendorName: vendor.name,
        totalAmount,
        paymentType: input.paymentType,
        paymentAccountId: input.paymentAccountId,
      });

      // 8. Link journal to purchase
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { journalEntryId: journalId },
      });

      return purchase;
    });
  }

  // ============================================
  // PURCHASE PAYMENT
  // ============================================

  async createPayment(tenantId: string, input: CreatePurchasePaymentInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get purchase
      const purchase = await tx.purchase.findFirst({
        where: { id: input.purchaseId, tenantId },
        include: { contact: true },
      });
      if (!purchase) throw new Error('Pembelian tidak ditemukan');
      if (purchase.status === 'PAID') throw new Error('Pembelian sudah lunas');
      if (purchase.status === 'VOID') throw new Error('Pembelian sudah dibatalkan');

      // 2. Validate payment
      const validation = validatePayment(
        new Decimal(purchase.totalAmount.toString()),
        new Decimal(purchase.paidAmount.toString()),
        new Decimal(input.amount)
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // 3. Generate payment number
      const paymentNumber = await this.getNextPaymentNumber(tx, tenantId, 'PP');

      // 4. Create payment
      const payment = await tx.purchasePayment.create({
        data: {
          tenantId,
          paymentNumber,
          purchaseId: input.purchaseId,
          paymentDate: input.paymentDate,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          paymentAccountId: input.paymentAccountId,
          notes: input.notes || null,
          createdBy: userId,
        },
      });

      // 5. Update purchase
      const newPaidAmount = new Decimal(purchase.paidAmount.toString()).add(input.amount);
      await tx.purchase.update({
        where: { id: input.purchaseId },
        data: {
          paidAmount: newPaidAmount,
          status: validation.newStatus,
        },
      });

      // 6. Generate journal
      const journalId = await generatePurchasePaymentJournal(tx, {
        tenantId,
        paymentNumber,
        paymentDate: input.paymentDate,
        amount: new Decimal(input.amount),
        paymentAccountId: input.paymentAccountId,
        vendorName: purchase.contact.name,
        purchaseNumber: purchase.purchaseNumber,
      });

      // 7. Link journal to payment
      await tx.purchasePayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalId },
      });

      return payment;
    });
  }

  // ============================================
  // PURCHASE RETURN
  // ============================================

  async createReturn(tenantId: string, input: CreatePurchaseReturnInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get purchase
      const purchase = await tx.purchase.findFirst({
        where: { id: input.purchaseId, tenantId },
        include: {
          contact: true,
          items: { include: { inventoryLayer: true, returnItems: true } },
        },
      });
      if (!purchase) throw new Error('Pembelian tidak ditemukan');
      if (purchase.status === 'VOID') throw new Error('Pembelian sudah dibatalkan');

      // 2. Validate and calculate return
      let subtotal = new Decimal(0);
      const returnItemsData = [];

      for (const returnItem of input.items) {
        const purchaseItem = purchase.items.find((i) => i.id === returnItem.purchaseItemId);
        if (!purchaseItem) throw new Error('Item pembelian tidak ditemukan');

        const alreadyReturned = purchaseItem.returnItems.reduce((sum, r) => sum + r.quantity, 0);

        // For inventory items, also check remaining stock in layer
        if (purchaseItem.inventoryLayer) {
          const validation = validatePurchaseReturn(
            purchaseItem.quantity,
            alreadyReturned,
            returnItem.quantity,
            purchaseItem.inventoryLayer.remainingQty
          );
          if (!validation.valid) throw new Error(validation.message);
        } else {
          if (returnItem.quantity > purchaseItem.quantity - alreadyReturned) {
            throw new Error(`Tidak dapat meretur ${returnItem.quantity}. Maksimal: ${purchaseItem.quantity - alreadyReturned}`);
          }
        }

        const itemAmount = new Decimal(purchaseItem.unitCost.toString()).mul(returnItem.quantity);
        subtotal = subtotal.add(itemAmount);

        returnItemsData.push({
          purchaseItemId: purchaseItem.id,
          productId: purchaseItem.productId,
          quantity: returnItem.quantity,
          unitCost: purchaseItem.unitCost,
          amount: itemAmount,
          inventoryLayerId: purchaseItem.inventoryLayerId,
        });
      }

      // 3. Generate return number
      const returnNumber = await this.getNextReturnNumber(tx, tenantId, 'PR');

      // 4. Create return record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          tenantId,
          returnNumber,
          purchaseId: input.purchaseId,
          returnDate: input.returnDate,
          reason: input.reason || null,
          subtotal,
          totalAmount: subtotal,
          refundType: input.refundType,
          refundAccountId: input.refundAccountId || null,
          createdBy: userId,
        },
      });

      // 5. Create return items and reduce inventory
      for (const itemData of returnItemsData) {
        await tx.purchaseReturnItem.create({
          data: {
            purchaseReturnId: purchaseReturn.id,
            purchaseItemId: itemData.purchaseItemId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitCost: itemData.unitCost,
            amount: itemData.amount,
          },
        });

        // Update purchase item returned qty
        await tx.purchaseItem.update({
          where: { id: itemData.purchaseItemId },
          data: { returnedQty: { increment: itemData.quantity } },
        });

        // Reduce inventory layer if exists
        if (itemData.inventoryLayerId) {
          const result = await reduceInventoryLayer(tx, itemData.inventoryLayerId, itemData.quantity);
          if (!result.success) throw new Error(result.error);
        }
      }

      // 6. Update purchase totals
      const newTotal = new Decimal(purchase.totalAmount.toString()).sub(subtotal);
      let newStatus = purchase.status;

      // Recalculate status
      if (newTotal.lessThanOrEqualTo(0)) {
        newStatus = 'PAID';
      } else if (new Decimal(purchase.paidAmount.toString()).greaterThanOrEqualTo(newTotal)) {
        newStatus = 'PAID';
      }

      await tx.purchase.update({
        where: { id: input.purchaseId },
        data: {
          totalAmount: newTotal,
          status: newStatus,
        },
      });

      // 7. Generate journal
      const journalId = await generatePurchaseReturnJournal(tx, {
        tenantId,
        returnNumber,
        returnDate: input.returnDate,
        amount: subtotal,
        vendorName: purchase.contact.name,
        purchaseNumber: purchase.purchaseNumber,
        refundType: input.refundType,
        refundAccountId: input.refundAccountId,
      });

      await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: { journalEntryId: journalId },
      });

      return purchaseReturn;
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async getNextPurchaseNumber(tx: any, tenantId: string): Promise<string> {
    const last = await tx.purchase.findFirst({
      where: { tenantId },
      orderBy: { purchaseNumber: 'desc' },
    });

    let seq = 1;
    if (last?.purchaseNumber) {
      const match = last.purchaseNumber.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }

    const year = new Date().getFullYear();
    return `PO-${year}-${String(seq).padStart(5, '0')}`;
  }

  private async getNextPaymentNumber(tx: any, tenantId: string, prefix: string): Promise<string> {
    const last = await tx.purchasePayment.findFirst({
      where: { tenantId },
      orderBy: { paymentNumber: 'desc' },
    });

    let seq = 1;
    if (last?.paymentNumber) {
      const match = last.paymentNumber.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }

    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }

  private async getNextReturnNumber(tx: any, tenantId: string, prefix: string): Promise<string> {
    const last = await tx.purchaseReturn.findFirst({
      where: { tenantId },
      orderBy: { returnNumber: 'desc' },
    });

    let seq = 1;
    if (last?.returnNumber) {
      const match = last.returnNumber.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }

    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }
}

export const purchaseService = new PurchaseService();
