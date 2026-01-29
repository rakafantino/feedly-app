import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import bcryptjs from 'bcryptjs';
import * as z from 'zod';

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum([ROLES.CASHIER]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session || !session.user?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC Check: Only OWNER can update users
    const currentUserRole = session.user.role?.toUpperCase();
    if (currentUserRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validationResult = userUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation Error', 
        details: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { name, email, password, role } = validationResult.data;

    // Pastikan user yang diedit ada di store yang sama
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { store: true }
    });

    if (!targetUser || targetUser.storeId !== session.user.storeId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent editing OWNER role if current user is not OWNER
    if (targetUser.role === ROLES.OWNER && currentUserRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Hanya Owner yang bisa mengedit Owner lain' }, { status: 403 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcryptjs.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ success: true, data: updatedUser });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    
    if (!session || !session.user?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RBAC Check: Only OWNER can delete users
    const currentUserRole = session.user.role?.toUpperCase();
    if (currentUserRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Forbidden: Hanya Owner yang bisa menghapus user' }, { status: 403 });
    }

    // Prevent self-deletion
    if (session.user.id === id) {
      return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    }

    // Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser || targetUser.storeId !== session.user.storeId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting other OWNERS (optional safety check)
    if (targetUser.role === ROLES.OWNER) {
       // Bisa di-allow jika sistem membolehkan multiple owner, tapi biasanya owner terakhir tidak boleh dihapus.
       // Untuk safety, kita warn dulu atau allow aja, asumsi owner tahu.
    }

    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
