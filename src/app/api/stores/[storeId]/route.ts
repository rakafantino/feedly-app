import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/stores/[storeId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const storeId = resolvedParams.storeId;

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
        }

        // Ideally only users linked to this store (or admins) should see details?
        // For simplicity allow any authenticated user to fetch store "public" info (name/address) if they have a link to it via cookie?
        // The receipt needs it.
        const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                email: true,
            }
        });

        if (!store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        return NextResponse.json({ store });
    } catch (error) {
        console.error('Error fetching store details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
