import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { reportService } from '@/services/report-service';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const asOfDateParam = searchParams.get('asOfDate');
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    const trialBalance = await reportService.getTrialBalance(tenantId, asOfDate);

    return successResponse({
      asOfDate,
      ...trialBalance,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
