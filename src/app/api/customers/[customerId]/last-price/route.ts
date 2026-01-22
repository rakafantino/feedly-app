import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';

export const GET = withAuth(async (request: any, session: any, storeId: string | null) => {
    try {
        if (!storeId) {
            return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
        }

        // Extract customerId from URL path
        // URL format: .../api/customers/[customerId]/last-price
        const parts = request.nextUrl.pathname.split('/');
        // parts = ['', 'api', 'customers', 'CUSTOMER_ID', 'last-price']
        // index:   0     1        2            3             4
        // We want index 3 if ends with last-price
        // Or just find the part after 'customers'
        const customerIndex = parts.indexOf('customers');
        const customerId = (customerIndex !== -1 && parts.length > customerIndex + 1)
            ? parts[customerIndex + 1]
            : null;

        if (!customerId) {
            return NextResponse.json({ error: 'Customer ID not found in URL' }, { status: 400 });
        }

        const searchParams = request.nextUrl.searchParams;
        const productId = searchParams.get('productId');

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        const lastTransactionItem = await prisma.transactionItem.findFirst({
            where: {
                productId: productId,
                transaction: {
                    storeId: storeId,
                    // @ts-ignore
                    customer: {
                        id: customerId
                    }
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                price: true,
            },
        });

        return NextResponse.json({
            price: lastTransactionItem ? lastTransactionItem.price : null,
        });
    } catch (error) {
        console.error('Error fetching last price:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}, { requireStore: true });
