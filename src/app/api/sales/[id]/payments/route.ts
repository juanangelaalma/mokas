import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { saleService } from '@/services/sale-service';
import { createSalePaymentSchema } from '@/schemas/sale.schema';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createSalePaymentSchema.parse({
      ...body,
      saleId: params.id,
    });
    
    const payment = await saleService.createPayment(tenantId, validatedData, user.id);

    return successResponse(payment, 'Pembayaran berhasil dicatat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
