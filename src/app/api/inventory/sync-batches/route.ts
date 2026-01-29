import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

/**
 * POST /api/inventory/sync-batches
 * 
 * Finds products with stock but no batch records (orphaned stock)
 * and creates batch records to make them transactable via POS.
 */
async function handler(request: Request, { storeId }: { storeId: string }) {
    try {
        const body = await request.json().catch(() => ({}));
        const { productId } = body; // Optional: sync specific product only

        // Find products with stock > 0 but no batch with remaining stock
        const whereClause: any = {
            storeId,
            stock: { gt: 0 },
        };

        if (productId) {
            whereClause.id = productId;
        }

        const productsWithStock = await prisma.product.findMany({
            where: whereClause,
            include: {
                batches: {
                    where: { stock: { gt: 0 } }
                }
            }
        });

        const synced: { productId: string; name: string; orphanStock: number; batchCreated: boolean }[] = [];

        for (const product of productsWithStock) {
            // Calculate total stock in batches
            const batchStock = product.batches.reduce((sum, b) => sum + b.stock, 0);
            const orphanStock = product.stock - batchStock;

            // Only create batch if there's orphan stock (stock not covered by batches)
            if (orphanStock > 0) {
                await prisma.productBatch.create({
                    data: {
                        productId: product.id,
                        batchNumber: `LEGACY-${Date.now()}-${product.id.slice(-4)}`,
                        stock: orphanStock,
                        purchasePrice: product.min_selling_price || product.purchase_price || 0,
                        expiryDate: product.expiry_date,
                        inDate: new Date(),
                    }
                });

                synced.push({
                    productId: product.id,
                    name: product.name,
                    orphanStock: orphanStock,
                    batchCreated: true
                });
            }
        }

        return NextResponse.json({
            message: `Synced ${synced.length} products with orphan stock`,
            synced
        });

    } catch (error) {
        console.error("Sync Batches Error:", error);
        return NextResponse.json(
            { error: "Failed to sync batches" },
            { status: 500 }
        );
    }
}

export const POST = withAuth(handler, { requireStore: true });
