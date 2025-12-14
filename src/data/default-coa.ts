import { AccountType, NormalBalance } from '@prisma/client';

export interface DefaultAccount {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isSystem?: boolean;
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccount[] = [
  // ASET (1xxx)
  { code: '1-0000', name: 'Aset', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true },

  // Aset Lancar
  { code: '1-1000', name: 'Aset Lancar', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-0000' },
  { code: '1-1001', name: 'Kas', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-1000', isSystem: true },
  { code: '1-1002', name: 'Bank BCA', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-1000' },
  { code: '1-1003', name: 'Bank Mandiri', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-1000' },
  { code: '1-1100', name: 'Piutang Usaha', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-1000', isSystem: true },
  { code: '1-1200', name: 'Persediaan Barang', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-1000' },

  // Aset Tetap
  { code: '1-2000', name: 'Aset Tetap', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-0000' },
  { code: '1-2001', name: 'Peralatan', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-2000' },
  { code: '1-2002', name: 'Kendaraan', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1-2000' },
  { code: '1-2099', name: 'Akumulasi Penyusutan', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1-2000' },

  // KEWAJIBAN (2xxx)
  { code: '2-0000', name: 'Kewajiban', type: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },

  // Kewajiban Lancar
  { code: '2-1000', name: 'Kewajiban Lancar', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-0000' },
  { code: '2-1001', name: 'Hutang Usaha', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-1000', isSystem: true },
  { code: '2-1002', name: 'Hutang Gaji', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-1000' },
  { code: '2-1003', name: 'Hutang Pajak', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-1000' },

  // Kewajiban Jangka Panjang
  { code: '2-2000', name: 'Kewajiban Jangka Panjang', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-0000' },
  { code: '2-2001', name: 'Hutang Bank', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2-2000' },

  // MODAL (3xxx)
  { code: '3-0000', name: 'Modal', type: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '3-1001', name: 'Modal Pemilik', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3-0000', isSystem: true },
  { code: '3-1002', name: 'Prive', type: 'EQUITY', normalBalance: 'DEBIT', parentCode: '3-0000' },
  { code: '3-2001', name: 'Laba Ditahan', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3-0000', isSystem: true },

  // PENDAPATAN (4xxx)
  { code: '4-0000', name: 'Pendapatan', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true },
  { code: '4-1001', name: 'Pendapatan Penjualan', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4-0000', isSystem: true },
  { code: '4-1002', name: 'Pendapatan Jasa', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4-0000' },
  { code: '4-2001', name: 'Pendapatan Lain-lain', type: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4-0000' },

  // BEBAN (5xxx)
  { code: '5-0000', name: 'Beban', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },

  // HPP
  { code: '5-1000', name: 'Harga Pokok Penjualan', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-0000' },
  { code: '5-1001', name: 'HPP - Pembelian Barang', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-1000' },

  // Beban Operasional
  { code: '5-2000', name: 'Beban Operasional', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-0000' },
  { code: '5-2001', name: 'Beban Gaji', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2002', name: 'Beban Sewa', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2003', name: 'Beban Listrik', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2004', name: 'Beban Telepon & Internet', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2005', name: 'Beban Transport', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2006', name: 'Beban Perlengkapan', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2007', name: 'Beban Penyusutan', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
  { code: '5-2099', name: 'Beban Lain-lain', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5-2000' },
];
