import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  
  return session.user;
}

export async function requireTenant() {
  const user = await requireAuth();
  
  if (!user.tenantId) {
    throw new Error('No tenant selected');
  }
  
  return { user, tenantId: user.tenantId };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}

export function errorResponse(error: any, status = 400) {
  const message = error instanceof Error ? error.message : 'An error occurred';
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  });
}
