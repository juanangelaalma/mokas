import { z } from 'zod';
import { PaymentType } from '@prisma/client';

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Produk harus dipilih'),
  description: z.string().optional(),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
  unitCost: z
    .number()
    .positive('Harga harus lebih dari 0')
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().positive()),
});

export const createPurchaseSchema = z.object({
  contactId: z.string().min(1, 'Supplier harus dipilih'),
  purchaseDate: z.string().or(z.date()).transform((val) => new Date(val)),
  paymentType: z.nativeEnum(PaymentType).default('CREDIT'),
  paymentAccountId: z.string().optional(), // Required for CASH
  items: z.array(purchaseItemSchema).min(1, 'Minimal 1 item'),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    console.log(data)
    if (data.paymentType === 'CASH' && !data.paymentAccountId) {
      return false;
    }
    return true;
  },
  {
    message: 'Akun pembayaran harus dipilih untuk pembelian tunai',
    path: ['paymentAccountId'],
  }
);

export const createPurchasePaymentSchema = z.object({
  purchaseId: z.string().min(1, 'ID pembelian harus ada'),
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

const purchaseReturnItemSchema = z.object({
  purchaseItemId: z.string().min(1, 'Item pembelian harus ada'),
  quantity: z.number().int().positive('Jumlah retur harus lebih dari 0'),
});

export const createPurchaseReturnSchema = z.object({
  purchaseId: z.string().min(1, 'ID pembelian harus ada'),
  returnDate: z.string().or(z.date()).transform((val) => new Date(val)),
  reason: z.string().optional().nullable(),
  items: z.array(purchaseReturnItemSchema).min(1, 'Minimal 1 item retur'),
  refundType: z.enum(['CREDIT_NOTE', 'CASH_REFUND']).default('CREDIT_NOTE'),
  refundAccountId: z.string().optional(),
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

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type CreatePurchasePaymentInput = z.infer<typeof createPurchasePaymentSchema>;
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
