import { z } from 'zod';
import { ProductType } from '@prisma/client';

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU harus diisi').max(50, 'SKU maksimal 50 karakter'),
  name: z.string().min(1, 'Nama produk harus diisi').max(100, 'Nama maksimal 100 karakter'),
  description: z.string().optional().nullable(),
  type: z.nativeEnum(ProductType).default('INVENTORY'),
  unit: z.string().default('pcs'),
  purchasePrice: z
    .number()
    .min(0, 'Harga beli tidak boleh negatif')
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().min(0)),
  sellingPrice: z
    .number()
    .min(0, 'Harga jual tidak boleh negatif')
    .or(z.string().transform((val) => parseFloat(val)))
    .pipe(z.number().min(0)),
  trackStock: z.boolean().default(true),
  minStock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
