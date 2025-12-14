import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_COA = [
  // ===== ASSET =====
  { code: '1-0000', name: 'Aset', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, isSystem: true },
  { code: '1-1000', name: 'Aset Lancar', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-0000' },

  { code: '1-1001', name: 'Kas', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-1000', isSystem: true },
  { code: '1-1002', name: 'Bank BCA', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-1000' },

  // ✅ AR
  { code: '1-1100', name: 'Piutang Usaha', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-1000', isSystem: true },

  // ✅ INVENTORY (NEW)
  { code: '1-1200', name: 'Persediaan Barang', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-1000', isSystem: true },

  { code: '1-2000', name: 'Aset Tetap', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-0000' },
  { code: '1-2001', name: 'Peralatan', type: 'ASSET' as const, normalBalance: 'DEBIT' as const, parentCode: '1-2000' },

  // ===== LIABILITY =====
  { code: '2-0000', name: 'Kewajiban', type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, isSystem: true },
  { code: '2-1000', name: 'Kewajiban Lancar', type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '2-0000' },

  // ✅ AP
  { code: '2-1001', name: 'Hutang Usaha', type: 'LIABILITY' as const, normalBalance: 'CREDIT' as const, parentCode: '2-1000', isSystem: true },

  // ===== EQUITY =====
  { code: '3-0000', name: 'Modal', type: 'EQUITY' as const, normalBalance: 'CREDIT' as const, isSystem: true },
  { code: '3-1001', name: 'Modal Pemilik', type: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3-0000', isSystem: true },
  { code: '3-2001', name: 'Laba Ditahan', type: 'EQUITY' as const, normalBalance: 'CREDIT' as const, parentCode: '3-0000', isSystem: true },

  // ===== REVENUE =====
  { code: '4-0000', name: 'Pendapatan', type: 'REVENUE' as const, normalBalance: 'CREDIT' as const, isSystem: true },

  // ✅ SALES REVENUE
  { code: '4-1001', name: 'Pendapatan Penjualan', type: 'REVENUE' as const, normalBalance: 'CREDIT' as const, parentCode: '4-0000', isSystem: true },

  // ✅ SALES RETURN (FIXED)
  { code: '4-1002', name: 'Retur Penjualan', type: 'REVENUE' as const, normalBalance: 'DEBIT' as const, parentCode: '4-0000', isSystem: true },

  // ===== EXPENSE =====
  { code: '5-0000', name: 'Beban', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, isSystem: true },

  { code: '5-1000', name: 'Harga Pokok Penjualan', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-0000' },

  // ✅ COGS DETAIL (NEW)
  { code: '5-1001', name: 'Harga Pokok Penjualan Barang', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-1000', isSystem: true },

  { code: '5-2000', name: 'Beban Operasional', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-0000' },
  { code: '5-2001', name: 'Beban Gaji', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-2000' },
  { code: '5-2002', name: 'Beban Sewa', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-2000' },
  { code: '5-2003', name: 'Beban Listrik', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-2000' },
  { code: '5-2099', name: 'Beban Lain-lain', type: 'EXPENSE' as const, normalBalance: 'DEBIT' as const, parentCode: '5-2000' },
];


async function main() {
  console.log('Seeding database...');

  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@mokas.id' },
  });

  if (existingUser) {
    console.log('Demo user already exists, skipping seed.');
    return;
  }

  const hashedPassword = await hash('demo123', 12);

  const user = await prisma.user.create({
    data: {
      email: 'demo@mokas.id',
      password: hashedPassword,
      name: 'Demo User',
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Toko Demo',
      slug: 'toko-demo',
      address: 'Jl. Demo No. 123',
      phone: '08123456789',
    },
  });

  await prisma.userTenant.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'OWNER',
      isDefault: true,
    },
  });

  const accountsToCreate = DEFAULT_COA.map((account) => ({
    tenantId: tenant.id,
    code: account.code,
    name: account.name,
    type: account.type,
    normalBalance: account.normalBalance,
    isSystem: account.isSystem || false,
  }));

  await prisma.account.createMany({
    data: accountsToCreate,
  });

  const createdAccounts = await prisma.account.findMany({
    where: { tenantId: tenant.id },
  });

  const codeToIdMap = new Map(createdAccounts.map((a) => [a.code, a.id]));

  for (const account of DEFAULT_COA) {
    if (account.parentCode) {
      const accountId = codeToIdMap.get(account.code);
      const parentId = codeToIdMap.get(account.parentCode);

      if (accountId && parentId) {
        await prisma.account.update({
          where: { id: accountId },
          data: { parentId },
        });
      }
    }
  }

  console.log('Seed completed!');
  console.log('Demo credentials:');
  console.log('Email: demo@mokas.id');
  console.log('Password: demo123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
