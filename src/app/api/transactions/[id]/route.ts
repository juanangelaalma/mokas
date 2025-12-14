import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { transactionService } from '@/services/transaction-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const transaction = await transactionService.getById(tenantId, params.id);

    if (!transaction) {
      return errorResponse(new Error('Transaksi tidak ditemukan'), 404);
    }

    return successResponse(transaction);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    await transactionService.void(tenantId, params.id, user.id);

    return successResponse(null, 'Transaksi berhasil dibatalkan');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
