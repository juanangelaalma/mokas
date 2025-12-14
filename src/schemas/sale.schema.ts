import { z } from 'zod';
import { PaymentType } from '@prisma/client';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Produk harus dipilih'),
  description: z.string().optional(),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
  unitPrice: z
    .number()
    .positive('Harga harus lebih dari 0')
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive()),
  discountPercent: z.number().min(0).max(100).default(0),
});

export const createSaleSchema = z.object({
  contactId: z.string().min(1, 'Pelanggan harus dipilih'),
  saleDate: z.string().or(z.date()).transform((val) => new Date(val)),
  paymentType: z.nativeEnum(PaymentType).default('CREDIT'),
  paymentAccountId: z.string().optional(), // Required for CASH
  items: z.array(saleItemSchema).min(1, 'Minimal 1 item'),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.paymentType === 'CASH' && !data.paymentAccountId) {
      return false;
    }
    return true;
  },
  {
    message: 'Akun pembayaran harus dipilih untuk penjualan tunai',
    path: ['paymentAccountId'],
  }
);

export const createSalePaymentSchema = z.object({
  saleId: z.string().min(1, 'ID penjualan harus ada'),
  paymentDate: z.string().or(z.date()).transform((val) => new Date(val)),
  amount: z
    .number()
    .positive('Jumlah harus lebih dari 0')
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive()),
  paymentMethod: z.string().min(1, 'Metode pembayaran harus dipilih'),
  paymentAccountId: z.string().min(1, 'Akun pembayaran harus dipilih'),
  notes: z.string().optional().nullable(),
});

const saleReturnItemSchema = z.object({
  saleItemId: z.string().min(1, 'Item penjualan harus ada'),
  quantity: z.number().int().positive('Jumlah retur harus lebih dari 0'),
});

export const createSaleReturnSchema = z.object({
  saleId: z.string().min(1, 'ID penjualan harus ada'),
  returnDate: z.string().or(z.date()).transform((val) => new Date(val)),
  reason: z.string().optional().nullable(),
  items: z.array(saleReturnItemSchema).min(1, 'Minimal 1 item retur'),
  refundType: z.enum(['CREDIT_NOTE', 'CASH_REFUND']).default('CREDIT_NOTE'),
  refundAccountId: z.string().optional(), // Required for CASH_REFUND
}).refine(
  (data) => {
    if (data.refundType === 'CASH_REFUND' && !data.refundAccountId) {
      return false;
    }
    return true;
  },
  {
    message: 'Akun refund harus dipilih untuk pengembalian tunai',
    path: ['refundAccountId'],
  }
);

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateSalePaymentInput = z.infer<typeof createSalePaymentSchema>;
export type CreateSaleReturnInput = z.infer<typeof createSaleReturnSchema>;
