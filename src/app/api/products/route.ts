import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { productService } from '@/services/product-service';
import { createProductSchema } from '@/schemas/product.schema';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') as any;
    const products = await productService.getAll(tenantId, type);

    return successResponse(products);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const validatedData = createProductSchema.parse(body);
    
    const product = await productService.create(tenantId, validatedData);

    return successResponse(product, 'Produk berhasil dibuat');
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    if (error.errors) {
      return errorResponse(new Error(error.errors[0].message));
    }
    return errorResponse(error);
  }
}
