import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { accountService } from '@/services/account-service';
import { updateAccountSchema } from '@/schemas/account.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const account = await accountService.getById(tenantId, params.id);

    if (!account) {
      return errorResponse(new Error('Akun tidak ditemukan'), 404);
    }

    return successResponse(account);
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
    const validatedData = updateAccountSchema.parse({ ...body, id: params.id });
    
    const account = await accountService.update(tenantId, validatedData);

    return successResponse(account, 'Akun berhasil diperbarui');
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
    await accountService.delete(tenantId, params.id);

    return successResponse(null, 'Akun berhasil dihapus');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
