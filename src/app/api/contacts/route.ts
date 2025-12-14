import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { contactService } from '@/services/contact-service';
import { createContactSchema } from '@/schemas/contact.schema';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') as any;
    
    let contacts;
    if (type === 'CUSTOMER') {
      contacts = await contactService.getCustomers(tenantId);
    } else if (type === 'VENDOR') {
      contacts = await contactService.getVendors(tenantId);
    } else {
      contacts = await contactService.getAll(tenantId);
    }

    return successResponse(contacts);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createContactSchema.parse(body);
    
    const contact = await contactService.create(tenantId, validatedData);

    return successResponse(contact, 'Kontak berhasil dibuat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
