import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil semua akses toko user ini
    // Kita cari berdasarkan User ID.
    // Perlu pastikan user ID ada di session. Session next-auth standard punya email, tapi id kadang perlu dikonfigurasi.
    // Di auth.ts biasanya kita pasang id ke token/session.

    // Fallback cari user by email jika session.user.id tidak ada (meski should be there)
    let userId = session.user.id;
    if (!userId) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      userId = user.id;
    }

    // SELF-HEALING: Check if user has legacy storeId but no StoreAccess record
    if (session.user.storeId) {
      const existingAccess = await prisma.storeAccess.findUnique({
        where: {
          userId_storeId: {
            userId: userId,
            storeId: session.user.storeId
          }
        }
      });

      if (!existingAccess) {
        // Create access for existing storeId
        // Defaulting to OWNER if role is 'OWNER', otherwise whatever their role string says or CASHIER fallback
        const userRole = session.user.role || ROLES.CASHIER; // Fallback

        // Cek dulu apakah storenya beneran ada
        const storeExists = await prisma.store.findUnique({ where: { id: session.user.storeId } });

        if (storeExists) {
          await prisma.storeAccess.create({
            data: {
              userId: userId,
              storeId: session.user.storeId,
              role: userRole
            }
          });
          console.log(`[Auto-Migration] Created StoreAccess for user ${userId} to store ${session.user.storeId}`);
        }
      }
    }

    // SELF-HEALING: Check if user has legacy storeId but no StoreAccess record
    if (session.user.storeId) {
      const existingAccess = await prisma.storeAccess.findUnique({
        where: {
          userId_storeId: {
            userId: userId,
            storeId: session.user.storeId
          }
        }
      });

      if (!existingAccess) {
        const userRole = session.user.role || ROLES.CASHIER; // Fallback
        const storeExists = await prisma.store.findUnique({ where: { id: session.user.storeId } });

        if (storeExists) {
          await prisma.storeAccess.create({
            data: {
              userId: userId,
              storeId: session.user.storeId,
              role: userRole
            }
          });
          console.log(`[Auto-Migration] Created StoreAccess for user ${userId} to store ${session.user.storeId}`);
        }
      }
    }

    const accesses = await prisma.storeAccess.findMany({
      where: {
        userId: userId
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            isActive: true
          }
        }
      }
    });

    // Format response
    const stores = accesses.map(access => ({
      id: access.store.id,
      name: access.store.name,
      address: access.store.address,
      role: access.role,
      isActive: access.store.isActive,
      isCurrent: access.store.id === session.user.storeId
    }));

    return NextResponse.json({ success: true, data: stores });

  } catch (error) {
    console.error('Error fetching user stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}
