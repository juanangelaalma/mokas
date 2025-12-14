import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { accountService } from '@/services/account-service';
import { createAccountSchema } from '@/schemas/account.schema';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type');
    const paymentOnly = searchParams.get('paymentOnly');
    
    let accounts;
    
    if (paymentOnly === 'true') {
      accounts = await accountService.getPaymentAccounts(tenantId);
    } else if (type) {
      accounts = await accountService.getByType(tenantId, type.split(','));
    } else {
      accounts = await accountService.getAll(tenantId);
    }

    return successResponse(accounts);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createAccountSchema.parse(body);
    
    const account = await accountService.create(tenantId, validatedData);

    return successResponse(account, 'Akun berhasil dibuat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
