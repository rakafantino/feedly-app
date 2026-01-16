import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let storeId = session.user?.storeId;

    if (!storeId) {
      const url = new URL(req.url);
      storeId = url.searchParams.get('storeId') || null;
    }

    if (!storeId) {
      // Coba dari cookie
      const cookieStoreId = req.cookies.get('selectedStoreId')?.value;
      if (cookieStoreId) storeId = cookieStoreId;
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        description: true,
        dailyTarget: true,
        weeklyTarget: true,
        monthlyTarget: true
      }
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: store });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      storeId,
      name,
      address,
      phone,
      email,
      description,
      dailyTarget,
      weeklyTarget,
      monthlyTarget
    } = body;

    // Validasi permission, pastikan user punya akses ke store ini, atau user adalah owner/admin
    // Simplifikasi: Cek apakah session.storeId cocok atau ada di body (jika admin)
    // Untuk sekarang kita percaya storeId dari frontend asalkan user logged in (Basic) 
    // Idealnya ada RBAC

    // Gunakan storeId dari session jika ada, jika tidak, dari body (untuk admin/multi-store)
    const targetStoreId = session.user?.storeId || storeId;

    if (!targetStoreId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (description !== undefined) updateData.description = description;

    // Handle targets (convert string to float if needed, or null)
    if (dailyTarget !== undefined) updateData.dailyTarget = dailyTarget ? parseFloat(dailyTarget) : null;
    if (weeklyTarget !== undefined) updateData.weeklyTarget = weeklyTarget ? parseFloat(weeklyTarget) : null;
    if (monthlyTarget !== undefined) updateData.monthlyTarget = monthlyTarget ? parseFloat(monthlyTarget) : null;

    const updatedStore = await prisma.store.update({
      where: { id: targetStoreId },
      data: updateData
    });

    return NextResponse.json({ success: true, data: updatedStore });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({
      error: 'Failed to update settings',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
