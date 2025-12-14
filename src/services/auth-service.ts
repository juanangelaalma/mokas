import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { generateSlug } from '@/lib/utils';
import { RegisterInput } from '@/schemas/auth.schema';
import { DEFAULT_CHART_OF_ACCOUNTS } from '@/data/default-coa';

export class AuthService {
  async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('Email sudah terdaftar');
    }

    const hashedPassword = await hash(input.password, 12);
    const slug = generateSlug(input.companyName);

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      throw new Error('Nama perusahaan sudah digunakan');
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName,
          slug,
        },
      });

      await tx.userTenant.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'OWNER',
          isDefault: true,
        },
      });

      const accountsToCreate = DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
        tenantId: tenant.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        isSystem: account.isSystem || false,
        parentId: null as string | null,
      }));

      await tx.account.createMany({
        data: accountsToCreate,
      });

      const createdAccounts = await tx.account.findMany({
        where: { tenantId: tenant.id },
      });

      const codeToIdMap = new Map(createdAccounts.map((a) => [a.code, a.id]));

      for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
        if (account.parentCode) {
          const accountId = codeToIdMap.get(account.code);
          const parentId = codeToIdMap.get(account.parentCode);

          if (accountId && parentId) {
            await tx.account.update({
              where: { id: accountId },
              data: { parentId },
            });
          }
        }
      }

      return { user, tenant };
    });

    return result;
  }

  async getUserTenants(userId: string) {
    return prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: true,
      },
      orderBy: {
        tenant: { name: 'asc' },
      },
    });
  }

  async setDefaultTenant(userId: string, tenantId: string) {
    await prisma.$transaction([
      prisma.userTenant.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      prisma.userTenant.update({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        data: { isDefault: true },
      }),
    ]);
  }
}

export const authService = new AuthService();
