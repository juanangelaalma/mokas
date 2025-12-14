import { NextRequest } from 'next/server';
import { requireTenant, errorResponse, successResponse, unauthorizedResponse } from '@/lib/auth-utils';
import { reportService } from '@/services/report-service';

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    const startDate = startDateParam 
      ? new Date(startDateParam) 
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam 
      ? new Date(endDateParam) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const journals = await reportService.getJournalReport(tenantId, startDate, endDate);

    return successResponse({
      period: { startDate, endDate },
      journals,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return unauthorizedResponse();
    return errorResponse(error);
  }
}
