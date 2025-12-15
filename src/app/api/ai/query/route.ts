import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { aiQueryService } from '@/services/ai-query-service';

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    
    const { query } = body;
    
    if (!query || typeof query !== 'string') {
      return errorResponse(new Error('Query harus berupa string'));
    }

    const result = await aiQueryService.processQuery(tenantId, query);

    return successResponse(result);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}

