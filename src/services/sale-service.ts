import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { CreateSaleInput, CreateSalePaymentInput, CreateSaleReturnInput } from '@/schemas/sale.schema';
import { consumeInventoryFIFO, restoreInventoryFromReturn, calculateReturnCogs } from '@/domain/inventory/fifo-engine';
import { generateSaleJournals, generateSalePaymentJournal, generateSaleReturnJournals } from './business-journal-service';
import { validateCreditLimit, validateStockAvailability, validateSaleReturn } from '@/domain/sales/validators';
import { calculateDueDate, validatePayment } from '@/domain/common/payment-handler';
import { embedSale } from '@/lib/vector';

export class SaleService {
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
      where.saleDate = {};
      if (options.startDate) where.saleDate.gte = options.startDate;
      if (options.endDate) where.saleDate.lte = options.endDate;
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          contact: { select: { id: true, code: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sale.count({ where }),
    ]);

    return { data: sales, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(tenantId: string, id: string) {
    return prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        contact: true,
        items: {
          include: {
            product: true,
            cogsDetails: { include: { inventoryLayer: true } },
            returnItems: true,
          },
        },
        payments: { include: { paymentAccount: true } },
        returns: { include: { items: true } },
        revenueJournal: { include: { lines: { include: { account: true } } } },
        cogsJournal: { include: { lines: { include: { account: true } } } },
      },
    });
  }

  // ============================================
  // CREATE SALE
  // ============================================

  async create(tenantId: string, input: CreateSaleInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get customer info
      const customer = await tx.contact.findUnique({
        where: { id: input.contactId },
      });
      if (!customer) throw new Error('Pelanggan tidak ditemukan');
      if (customer.type === 'VENDOR') throw new Error('Kontak bukan pelanggan');

      // 2. Calculate amounts
      let subtotal = new Decimal(0);
      for (const item of input.items) {
        const itemAmount = new Decimal(item.unitPrice)
          .mul(item.quantity)
          .mul(1 - (item.discountPercent || 0) / 100);
        subtotal = subtotal.add(itemAmount);
      }
      const discountAmount = new Decimal(input.discountAmount || 0);
      const taxAmount = new Decimal(input.taxAmount || 0);
      const totalAmount = subtotal.sub(discountAmount).add(taxAmount);

      // 3. Validate credit limit for credit sales
      if (input.paymentType === 'CREDIT') {
        const creditCheck = await validateCreditLimit(tenantId, input.contactId, totalAmount);
        if (!creditCheck.valid) {
          throw new Error(creditCheck.message);
        }
      }

      // 4. Validate stock availability for inventory items
      const inventoryItems: { productId: string; quantity: number }[] = [];
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product?.type === 'INVENTORY') {
          inventoryItems.push({ productId: item.productId, quantity: item.quantity });
        }
      }

      if (inventoryItems.length > 0) {
        const stockCheck = await validateStockAvailability(tenantId, inventoryItems);
        const invalid = stockCheck.find((s) => !s.valid);
        if (invalid) {
          throw new Error(invalid.message);
        }
      }

      // 5. Calculate due date
      const dueDate =
        input.paymentType === 'CASH'
          ? input.saleDate
          : calculateDueDate(input.saleDate, customer.paymentTermDays);

      // 6. Generate sale number
      const saleNumber = await this.getNextSaleNumber(tx, tenantId);

      // 7. Create sale record
      const sale = await tx.sale.create({
        data: {
          tenantId,
          saleNumber,
          contactId: input.contactId,
          saleDate: input.saleDate,
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

      // 8. Create sale items & consume inventory (FIFO)
      let totalCogs = new Decimal(0);
      let hasInventoryItems = false;

      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) throw new Error(`Produk tidak ditemukan`);

        const itemAmount = new Decimal(item.unitPrice)
          .mul(item.quantity)
          .mul(1 - (item.discountPercent || 0) / 100);

        // Create sale item
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            description: item.description || product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent || 0,
            amount: itemAmount,
            totalCogs: 0,
          },
        });

        // Consume inventory for INVENTORY products (FIFO)
        if (product.type === 'INVENTORY') {
          hasInventoryItems = true;

          const fifoResult = await consumeInventoryFIFO(
            tenantId,
            item.productId,
            item.quantity,
            tx
          );

          if (!fifoResult.success) {
            throw new Error(fifoResult.error);
          }

          // Create COGS details
          for (const detail of fifoResult.details) {
            await tx.costOfGoodsDetail.create({
              data: {
                saleItemId: saleItem.id,
                inventoryLayerId: detail.inventoryLayerId,
                quantity: detail.quantityConsumed,
                unitCost: detail.unitCost,
                totalCost: detail.totalCost,
              },
            });
          }

          // Update sale item with COGS
          await tx.saleItem.update({
            where: { id: saleItem.id },
            data: { totalCogs: fifoResult.totalCost },
          });

          totalCogs = totalCogs.add(fifoResult.totalCost);
        }
      }

      // 9. Generate journal entries
      const { revenueJournalId, cogsJournalId } = await generateSaleJournals(tx, {
        tenantId,
        saleNumber,
        saleDate: input.saleDate,
        customerName: customer.name,
        totalAmount,
        totalCogs,
        paymentType: input.paymentType,
        paymentAccountId: input.paymentAccountId,
        hasInventoryItems,
      });

      // 10. Link journals to sale
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          revenueJournalId,
          cogsJournalId,
        },
        include: {
          contact: true,
          items: { include: { product: true } },
        },
      });

      // Index sale to vector store (background, after transaction)
      setImmediate(() => {
        embedSale(updatedSale, tenantId).catch(console.error);
      });

      return updatedSale;
    });
  }

  // ============================================
  // SALE PAYMENT
  // ============================================

  async createPayment(tenantId: string, input: CreateSalePaymentInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get sale
      const sale = await tx.sale.findFirst({
        where: { id: input.saleId, tenantId },
        include: { contact: true },
      });
      if (!sale) throw new Error('Penjualan tidak ditemukan');
      if (sale.status === 'PAID') throw new Error('Penjualan sudah lunas');
      if (sale.status === 'VOID') throw new Error('Penjualan sudah dibatalkan');

      // 2. Validate payment
      const validation = validatePayment(
        new Decimal(sale.totalAmount.toString()),
        new Decimal(sale.paidAmount.toString()),
        new Decimal(input.amount)
      );

      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // 3. Generate payment number
      const paymentNumber = await this.getNextPaymentNumber(tx, tenantId, 'SP');

      // 4. Create payment
      const payment = await tx.salePayment.create({
        data: {
          tenantId,
          paymentNumber,
          saleId: input.saleId,
          paymentDate: input.paymentDate,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          paymentAccountId: input.paymentAccountId,
          notes: input.notes || null,
          createdBy: userId,
        },
      });

      // 5. Update sale
      const newPaidAmount = new Decimal(sale.paidAmount.toString()).add(input.amount);
      await tx.sale.update({
        where: { id: input.saleId },
        data: {
          paidAmount: newPaidAmount,
          status: validation.newStatus,
        },
      });

      // 6. Generate journal
      const journalId = await generateSalePaymentJournal(tx, {
        tenantId,
        paymentNumber,
        paymentDate: input.paymentDate,
        amount: new Decimal(input.amount),
        paymentAccountId: input.paymentAccountId,
        customerName: sale.contact.name,
        saleNumber: sale.saleNumber,
      });

      // 7. Link journal to payment
      await tx.salePayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalId },
      });

      return payment;
    });
  }

  // ============================================
  // SALE RETURN
  // ============================================

  async createReturn(tenantId: string, input: CreateSaleReturnInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Get sale
      const sale = await tx.sale.findFirst({
        where: { id: input.saleId, tenantId },
        include: {
          contact: true,
          items: {
            include: {
              product: true,
              cogsDetails: true,
              returnItems: true,
            },
          },
        },
      });
      if (!sale) throw new Error('Penjualan tidak ditemukan');
      if (sale.status === 'VOID') throw new Error('Penjualan sudah dibatalkan');

      // 2. Validate and calculate return
      let subtotal = new Decimal(0);
      let totalCogsToRestore = new Decimal(0);
      const returnItemsData: any[] = [];
      let hasInventoryItems = false;

      for (const returnItem of input.items) {
        const saleItem = sale.items.find((i) => i.id === returnItem.saleItemId);
        if (!saleItem) throw new Error('Item penjualan tidak ditemukan');

        const alreadyReturned = saleItem.returnItems.reduce((sum, r) => sum + r.quantity, 0);

        const validation = validateSaleReturn(
          saleItem.quantity,
          alreadyReturned,
          returnItem.quantity
        );
        if (!validation.valid) throw new Error(validation.message);

        // Calculate return amount (proportional to original price)
        const unitPrice = new Decimal(saleItem.amount.toString()).div(saleItem.quantity);
        const itemAmount = unitPrice.mul(returnItem.quantity);
        subtotal = subtotal.add(itemAmount);

        // Calculate COGS to restore (if inventory item)
        let itemCogs = new Decimal(0);
        if (saleItem.product.type === 'INVENTORY' && saleItem.cogsDetails.length > 0) {
          hasInventoryItems = true;
          const cogsResult = await calculateReturnCogs(tx, saleItem.id, returnItem.quantity);
          itemCogs = cogsResult.totalCost;
          totalCogsToRestore = totalCogsToRestore.add(itemCogs);
        }

        returnItemsData.push({
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          quantity: returnItem.quantity,
          unitPrice,
          amount: itemAmount,
          cogsAmount: itemCogs,
          isInventory: saleItem.product.type === 'INVENTORY',
        });
      }

      // 3. Generate return number
      const returnNumber = await this.getNextReturnNumber(tx, tenantId, 'SR');

      // 4. Create return record
      const saleReturn = await tx.saleReturn.create({
        data: {
          tenantId,
          returnNumber,
          saleId: input.saleId,
          returnDate: input.returnDate,
          reason: input.reason || null,
          subtotal,
          totalAmount: subtotal,
          refundType: input.refundType,
          refundAccountId: input.refundAccountId || null,
          createdBy: userId,
        },
      });

      // 5. Create return items and restore inventory
      for (const itemData of returnItemsData) {
        await tx.saleReturnItem.create({
          data: {
            saleReturnId: saleReturn.id,
            saleItemId: itemData.saleItemId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            amount: itemData.amount,
            cogsAmount: itemData.cogsAmount,
          },
        });

        // Update sale item returned qty
        await tx.saleItem.update({
          where: { id: itemData.saleItemId },
          data: { returnedQty: { increment: itemData.quantity } },
        });

        // Restore inventory for inventory items
        if (itemData.isInventory && itemData.cogsAmount.greaterThan(0)) {
          await restoreInventoryFromReturn(
            tx,
            tenantId,
            itemData.productId,
            itemData.quantity,
            itemData.cogsAmount,
            saleReturn.id,
            input.returnDate
          );
        }
      }

      // 6. Update sale totals
      const newTotal = new Decimal(sale.totalAmount.toString()).sub(subtotal);
      let newStatus = sale.status;

      // Recalculate status
      if (newTotal.lessThanOrEqualTo(0)) {
        newStatus = 'PAID';
      } else if (new Decimal(sale.paidAmount.toString()).greaterThanOrEqualTo(newTotal)) {
        newStatus = 'PAID';
      }

      await tx.sale.update({
        where: { id: input.saleId },
        data: {
          totalAmount: newTotal,
          status: newStatus,
        },
      });

      // 7. Generate journals
      const { revenueJournalId, cogsJournalId } = await generateSaleReturnJournals(tx, {
        tenantId,
        returnNumber,
        returnDate: input.returnDate,
        amount: subtotal,
        cogsAmount: totalCogsToRestore,
        customerName: sale.contact.name,
        saleNumber: sale.saleNumber,
        refundType: input.refundType,
        refundAccountId: input.refundAccountId,
        hasInventoryItems,
      });

      await tx.saleReturn.update({
        where: { id: saleReturn.id },
        data: {
          revenueJournalId,
          cogsJournalId,
        },
      });

      return saleReturn;
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async getNextSaleNumber(tx: any, tenantId: string): Promise<string> {
    const last = await tx.sale.findFirst({
      where: { tenantId },
      orderBy: { saleNumber: 'desc' },
    });

    let seq = 1;
    if (last?.saleNumber) {
      const match = last.saleNumber.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }

    const year = new Date().getFullYear();
    return `INV-${year}-${String(seq).padStart(5, '0')}`;
  }

  private async getNextPaymentNumber(tx: any, tenantId: string, prefix: string): Promise<string> {
    const last = await tx.salePayment.findFirst({
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
    const last = await tx.saleReturn.findFirst({
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

export const saleService = new SaleService();
