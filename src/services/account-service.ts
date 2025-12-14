import prisma from '@/lib/prisma';
import { CreateAccountInput, UpdateAccountInput } from '@/schemas/account.schema';
import {
  validateSystemAccountNotDeleted,
  validateAccountHasNoTransactions,
  getExpectedNormalBalance,
} from '@/domain/accounting/validators';

export class AccountService {
  async getAll(tenantId: string) {
    return prisma.account.findMany({
      where: { tenantId },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getById(tenantId: string, id: string) {
    return prisma.account.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: {
          orderBy: { code: 'asc' },
        },
      },
    });
  }

  async getByCode(tenantId: string, code: string) {
    return prisma.account.findFirst({
      where: { tenantId, code },
    });
  }

  async getByType(tenantId: string, types: string[]) {
    return prisma.account.findMany({
      where: {
        tenantId,
        type: { in: types as any },
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async getPaymentAccounts(tenantId: string) {
    return prisma.account.findMany({
      where: {
        tenantId,
        type: 'ASSET',
        isActive: true,
        code: {
          startsWith: '1-1',
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getSystemAccounts(tenantId: string) {
    const accounts = await prisma.account.findMany({
      where: {
        tenantId,
        isSystem: true,
        code: {
          in: ['1-1100', '2-1001'],
        },
      },
    });

    const receivable = accounts.find((a) => a.code === '1-1100');
    const payable = accounts.find((a) => a.code === '2-1001');

    if (!receivable || !payable) {
      throw new Error('System accounts not found. Please contact support.');
    }

    return {
      receivable: receivable.id,
      payable: payable.id,
    };
  }

  async create(tenantId: string, input: CreateAccountInput) {
    const existing = await prisma.account.findFirst({
      where: { tenantId, code: input.code },
    });

    if (existing) {
      throw new Error('Kode akun sudah digunakan');
    }

    const expectedNormalBalance = getExpectedNormalBalance(input.type);
    const normalBalance = input.normalBalance || expectedNormalBalance;

    return prisma.account.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        normalBalance,
        parentId: input.parentId,
        description: input.description,
        isActive: input.isActive,
        isSystem: false,
      },
    });
  }

  async update(tenantId: string, input: UpdateAccountInput) {
    const account = await prisma.account.findFirst({
      where: { id: input.id, tenantId },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    if (input.code && input.code !== account.code) {
      const existing = await prisma.account.findFirst({
        where: { tenantId, code: input.code },
      });

      if (existing) {
        throw new Error('Kode akun sudah digunakan');
      }
    }

    return prisma.account.update({
      where: { id: input.id },
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        normalBalance: input.normalBalance,
        parentId: input.parentId,
        description: input.description,
        isActive: input.isActive,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const account = await prisma.account.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { lines: true, children: true },
        },
      },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    validateSystemAccountNotDeleted(account.isSystem);
    validateAccountHasNoTransactions(account._count.lines);

    if (account._count.children > 0) {
      throw new Error('Akun tidak dapat dihapus karena memiliki sub-akun');
    }

    return prisma.account.delete({
      where: { id },
    });
  }

  async getHierarchy(tenantId: string) {
    const accounts = await prisma.account.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    const buildTree = (parentId: string | null): any[] => {
      return accounts
        .filter((a) => a.parentId === parentId)
        .map((account) => ({
          ...account,
          children: buildTree(account.id),
        }));
    };

    return buildTree(null);
  }
}

export const accountService = new AccountService();
