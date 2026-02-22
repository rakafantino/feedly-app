import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId! },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        description: true,
        dailyTarget: true,
        weeklyTarget: true,
        monthlyTarget: true,
        expiryNotificationDays: true,
        stockNotificationInterval: true
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
}, { requireStore: true });

export const PATCH = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const body = await req.json();
    const {
      name,
      address,
      phone,
      email,
      description,
      dailyTarget,
      weeklyTarget,
      monthlyTarget,
      expiryNotificationDays,
      stockNotificationInterval
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (description !== undefined) updateData.description = description;

    // Handle targets (convert string to float if needed, or null)
    if (dailyTarget !== undefined) updateData.dailyTarget = dailyTarget ? parseFloat(dailyTarget) : null;
    if (weeklyTarget !== undefined) updateData.weeklyTarget = weeklyTarget ? parseFloat(weeklyTarget) : null;
    if (monthlyTarget !== undefined) updateData.monthlyTarget = monthlyTarget ? parseFloat(monthlyTarget) : null;
    
    if (expiryNotificationDays !== undefined) {
      updateData.expiryNotificationDays = expiryNotificationDays ? parseInt(expiryNotificationDays) : 30;
    }
    
    if (stockNotificationInterval !== undefined) {
         updateData.stockNotificationInterval = stockNotificationInterval ? parseInt(stockNotificationInterval) : 60;
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId! },
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
}, { requireStore: true });
