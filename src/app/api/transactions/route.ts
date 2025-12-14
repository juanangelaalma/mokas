import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { transactionService } from '@/services/transaction-service';
import { createTransactionSchema } from '@/schemas/transaction.schema';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const options: any = {};
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (type) options.type = type;
    if (status) options.status = status;
    if (page) options.page = parseInt(page);
    if (pageSize) options.pageSize = parseInt(pageSize);

    const result = await transactionService.getAll(tenantId, options);

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
    const validatedData = createTransactionSchema.parse(body);
    
    const result = await transactionService.create(tenantId, validatedData, user.id);

    return successResponse(result, 'Transaksi berhasil dibuat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
