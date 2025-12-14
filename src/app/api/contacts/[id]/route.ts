import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { contactService } from '@/services/contact-service';
import { updateContactSchema } from '@/schemas/contact.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    
    const contact = await contactService.getById(tenantId, params.id);
    if (!contact) {
      return errorResponse(new Error('Kontak tidak ditemukan'), 404);
    }

    const balance = await contactService.getOutstandingBalance(tenantId, params.id);

    return successResponse({ ...contact, ...balance });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = updateContactSchema.parse({ ...body, id: params.id });
    
    const contact = await contactService.update(tenantId, params.id, validatedData);

    return successResponse(contact, 'Kontak berhasil diperbarui');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    await contactService.delete(tenantId, params.id);

    return successResponse(null, 'Kontak berhasil dihapus');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
