import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { productService } from '@/services/product-service';
import { updateProductSchema } from '@/schemas/product.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    
    const product = await productService.getById(tenantId, params.id);
    if (!product) {
      return errorResponse(new Error('Produk tidak ditemukan'), 404);
    }

    return successResponse(product);
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
    const validatedData = updateProductSchema.parse({ ...body, id: params.id });
    
    const product = await productService.update(tenantId, params.id, validatedData);

    return successResponse(product, 'Produk berhasil diperbarui');
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
    await productService.delete(tenantId, params.id);

    return successResponse(null, 'Produk berhasil dihapus');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
