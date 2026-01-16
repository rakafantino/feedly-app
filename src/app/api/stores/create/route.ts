import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import * as z from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(3, "Nama toko minimal 3 karakter"),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validation = createStoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation Error',
        details: validation.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const { name, description, address, phone } = validation.data;

    let userId = session.user.id;
    if (!userId) {
       const user = await prisma.user.findUnique({ where: { email: session.user.email } });
       if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
       userId = user.id;
    }

    // Gunakan transaction untuk memastikan store dan akses terbuat bersamaan
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat Toko
      const newStore = await tx.store.create({
        data: {
          name,
          description,
          address,
          phone,
        }
      });

      // 2. Buat Akses Owner untuk pembuat
      await tx.storeAccess.create({
        data: {
          userId: userId!,
          storeId: newStore.id,
          role: ROLES.OWNER
        }
      });

      // 3. Update user active storeId langsung agar user langsung masuk ke toko baru?
      // Opsional, tapi biasanya UX yang baik adalah switch otomatis atau user disuruh switch.
      // Kita update active storeId user.
      await tx.user.update({
        where: { id: userId },
        data: { storeId: newStore.id }
      });

      return newStore;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });

  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
