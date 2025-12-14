import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/schemas/auth.schema';
import { authService } from '@/services/auth-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);
    
    const result = await authService.register(validatedData);

    return NextResponse.json({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
      },
    });
  } catch (error: any) {
    if (error.errors) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Registrasi gagal' },
      { status: 400 }
    );
  }
}
