import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { purchaseService } from '@/services/purchase-service';
import { createPurchaseReturnSchema } from '@/schemas/purchase.schema';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createPurchaseReturnSchema.parse({
      ...body,
      purchaseId: params.id,
    });
    
    const purchaseReturn = await purchaseService.createReturn(tenantId, validatedData, user.id);

    return successResponse(purchaseReturn, 'Retur pembelian berhasil dicatat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
