import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateCustomerSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
});

// GET /api/customers/[customerId]
export const GET = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
        // Extract customerId from URL since withAuth signature doesn't pass params object directly as 3rd arg (it passes storeId)
        // We need to parse it manually if the middleware signature is (req, session, storeId)
        // Standard Next.js route handler: (req, context)
        // withAuth wraps this. Let's see how withAuth passes params. 
        // Usually withAuth(handler) -> handler(req, session, storeId)
        // BUT we also need route params (customerId).
        // Let's inspect request.nextUrl or just assume withAuth implementation details.

        // Quick fix: URL split or check withAuth implementation.
        // Assuming URL is /api/customers/[customerId]
        const parts = request.nextUrl.pathname.split('/');
        const customerId = parts[parts.length - 1];

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                storeId: storeId!, // Ensure isolation
            },
        });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        return NextResponse.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });

export const PATCH = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
        const parts = request.nextUrl.pathname.split('/');
        const customerId = parts[parts.length - 1];

        const body = await request.json();
        const result = updateCustomerSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error.errors }, { status: 400 });
        }

        try {
            // Verify ownership first
            const existingCustomer = await prisma.customer.findFirst({
                where: { id: customerId, storeId: storeId! }
            });

            if (!existingCustomer) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            const customer = await prisma.customer.update({
                where: {
                    id: customerId,
                },
                data: result.data,
            });
            return NextResponse.json(customer);
        } catch (e: any) {
            if (e.code === 'P2025') {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
            throw e;
        }
    } catch (error) {
        console.error('Error updating customer:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });

export const DELETE = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
        const parts = request.nextUrl.pathname.split('/');
        const customerId = parts[parts.length - 1];

        try {
            // Verify ownership first
            const existingCustomer = await prisma.customer.findFirst({
                where: { id: customerId, storeId: storeId! }
            });

            if (!existingCustomer) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            const customer = await prisma.customer.delete({
                where: {
                    id: customerId,
                },
            });
            return NextResponse.json(customer);
        } catch (e: any) {
            if (e.code === 'P2025') {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
            throw e;
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });
