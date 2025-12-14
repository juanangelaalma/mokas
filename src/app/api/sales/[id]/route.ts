import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { saleService } from '@/services/sale-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    
    const sale = await saleService.getById(tenantId, params.id);
    if (!sale) {
      return errorResponse(new Error('Penjualan tidak ditemukan'), 404);
    }

    return successResponse(sale);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
