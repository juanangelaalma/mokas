import { z } from 'zod';
import { ContactType } from '@prisma/client';

export const createContactSchema = z.object({
  name: z.string().min(1, 'Nama harus diisi').max(100, 'Nama maksimal 100 karakter'),
  type: z.nativeEnum(ContactType, { errorMap: () => ({ message: 'Tipe kontak tidak valid' }) }),
  email: z.string().email('Email tidak valid').optional().nullable().or(z.literal('')),
  phone: z.string().max(20, 'Nomor telepon maksimal 20 karakter').optional().nullable(),
  address: z.string().max(500, 'Alamat maksimal 500 karakter').optional().nullable(),
  taxId: z.string().max(30, 'NPWP maksimal 30 karakter').optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateContactSchema = createContactSchema.partial().extend({
  id: z.string(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
