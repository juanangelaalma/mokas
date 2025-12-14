import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { purchaseService } from '@/services/purchase-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    
    const purchase = await purchaseService.getById(tenantId, params.id);
    if (!purchase) {
      return errorResponse(new Error('Pembelian tidak ditemukan'), 404);
    }

    return successResponse(purchase);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
