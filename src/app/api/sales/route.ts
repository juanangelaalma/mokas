import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { saleService } from '@/services/sale-service';
import { createSaleSchema } from '@/schemas/sale.schema';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const options: any = {};
    
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');

    if (status) options.status = status;
    if (contactId) options.contactId = contactId;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (page) options.page = parseInt(page);
    if (pageSize) options.pageSize = parseInt(pageSize);

    const result = await saleService.getAll(tenantId, options);

    return successResponse(result);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createSaleSchema.parse(body);

    console.log(validatedData);
    
    const sale = await saleService.create(tenantId, validatedData, user.id);

    return successResponse(sale, 'Penjualan berhasil dibuat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
