import { z } from 'zod';
import { AccountType, NormalBalance } from '@prisma/client';

export const createAccountSchema = z.object({
  code: z.string().min(1, 'Kode akun harus diisi').max(20, 'Kode akun maksimal 20 karakter'),
  name: z.string().min(1, 'Nama akun harus diisi').max(100, 'Nama akun maksimal 100 karakter'),
  type: z.nativeEnum(AccountType, { errorMap: () => ({ message: 'Tipe akun tidak valid' }) }),
  normalBalance: z.nativeEnum(NormalBalance, { errorMap: () => ({ message: 'Saldo normal tidak valid' }) }),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  id: z.string(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
