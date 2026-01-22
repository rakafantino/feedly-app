import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const customerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().optional(),
    address: z.string().optional(),
});

export const POST = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

        // storeId is already provided by withAuth middleware
        const body = await request.json();
        const result = customerSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.errors }, { status: 400 });
        }

        const customer = await prisma.customer.create({
            data: {
                ...result.data,
                storeId: storeId,
            },
        });

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        console.error('Error creating customer:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });

export const GET = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

        const customers = await prisma.customer.findMany({
            where: {
                storeId: storeId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });
