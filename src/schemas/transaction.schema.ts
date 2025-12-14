import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const createTransactionSchema = z.object({
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  type: z.nativeEnum(TransactionType, { errorMap: () => ({ message: 'Tipe transaksi tidak valid' }) }),
  description: z.string().min(1, 'Deskripsi harus diisi').max(255, 'Deskripsi maksimal 255 karakter'),
  amount: z.number().positive('Jumlah harus lebih dari 0').or(
    z.string().transform((val) => parseFloat(val))
  ).pipe(z.number().positive('Jumlah harus lebih dari 0')),
  paymentAccountId: z.string().min(1, 'Akun pembayaran harus dipilih'),
  categoryAccountId: z.string().min(1, 'Akun kategori harus dipilih'),
  contactId: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateTransactionSchema = createTransactionSchema.partial().extend({
  id: z.string(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
