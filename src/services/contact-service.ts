import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { CreateContactInput, UpdateContactInput } from '@/schemas/contact.schema';
import { ContactType } from '@prisma/client';

export class ContactService {
  async getAll(tenantId: string, type?: ContactType) {
    return prisma.contact.findMany({
      where: {
        tenantId,
        ...(type && { type: { in: type === 'BOTH' ? ['CUSTOMER', 'VENDOR', 'BOTH'] : [type, 'BOTH'] } }),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCustomers(tenantId: string) {
    return prisma.contact.findMany({
      where: {
        tenantId,
        type: { in: ['CUSTOMER', 'BOTH'] },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getVendors(tenantId: string) {
    return prisma.contact.findMany({
      where: {
        tenantId,
        type: { in: ['VENDOR', 'BOTH'] },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(tenantId: string, id: string) {
    return prisma.contact.findFirst({
      where: { id, tenantId },
    });
  }

  async create(tenantId: string, input: CreateContactInput) {
    // Generate contact code
    const prefix = input.type === 'VENDOR' ? 'V' : 'C';
    const count = await prisma.contact.count({
      where: { tenantId, code: { startsWith: prefix } },
    });
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    return prisma.contact.create({
      data: {
        tenantId,
        code,
        name: input.name,
        type: input.type,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        taxId: input.taxId || null,
        notes: input.notes || null,
        creditLimit: input.creditLimit || 0,
        paymentTermDays: input.paymentTermDays || 0,
        isActive: input.isActive,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateContactInput) {
    const contact = await this.getById(tenantId, id);
    if (!contact) throw new Error('Kontak tidak ditemukan');

    return prisma.contact.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        email: input.email,
        phone: input.phone,
        address: input.address,
        taxId: input.taxId,
        notes: input.notes,
        creditLimit: input.creditLimit,
        paymentTermDays: input.paymentTermDays,
        isActive: input.isActive,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const contact = await this.getById(tenantId, id);
    if (!contact) throw new Error('Kontak tidak ditemukan');

    // Check for existing transactions
    const salesCount = await prisma.sale.count({ where: { contactId: id } });
    const purchasesCount = await prisma.purchase.count({ where: { contactId: id } });

    if (salesCount > 0 || purchasesCount > 0) {
      throw new Error('Kontak tidak dapat dihapus karena memiliki transaksi');
    }

    return prisma.contact.delete({ where: { id } });
  }

  async getOutstandingBalance(tenantId: string, contactId: string) {
    // Outstanding AR (for customers)
    const arBalance = await prisma.sale.aggregate({
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

    // Outstanding AP (for vendors)
    const apBalance = await prisma.purchase.aggregate({
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

    const receivable = new Decimal(arBalance._sum.totalAmount?.toString() || '0')
      .sub(arBalance._sum.paidAmount?.toString() || '0');

    const payable = new Decimal(apBalance._sum.totalAmount?.toString() || '0')
      .sub(apBalance._sum.paidAmount?.toString() || '0');

    return {
      receivable: receivable.toNumber(),
      payable: payable.toNumber(),
    };
  }
}

export const contactService = new ContactService();
