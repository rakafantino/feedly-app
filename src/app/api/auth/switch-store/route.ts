import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId } = await req.json();

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Verifikasi user punya akses ke store ini
    const access = await prisma.storeAccess.findUnique({
      where: {
        userId_storeId: {
          userId: session.user.id,
          storeId: storeId
        }
      }
    });

    if (!access) {
      return NextResponse.json({ error: 'Forbidden: No access to this store' }, { status: 403 });
    }

    // Update active store di user profile
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        storeId: storeId,
        role: access.role // Update juga cached role di user table agar session strategy (jika pakai DB check) sync
      }
    });

    // Note: Client harus trigger update session (e.g. reload or next-auth update)
    return NextResponse.json({ success: true, message: 'Store switched successfully' });

  } catch (error) {
    console.error('Error switching store:', error);
    return NextResponse.json({ error: 'Failed to switch store' }, { status: 500 });
  }
}
