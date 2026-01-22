import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(async (req: NextRequest, session: any, storeId: string | null) => {
    try {
        const body = await req.json();
        const { parentProductId, conversionRate, retailUnit, retailPrice } = body;

        // Ensure storeId is present (withAuth should ensure this if requireStore is true, but good to check)
        if (!storeId) {
            return NextResponse.json({ error: "Store ID missing" }, { status: 400 });
        }

        if (!parentProductId || !conversionRate || !retailUnit) {
            return NextResponse.json(
                { error: "Missing required fields: parentProductId, conversionRate, retailUnit" },
                { status: 400 }
            );
        }

        // 1. Get Parent Product
        const parentProduct = await prisma.product.findUnique({
            where: { id: parentProductId, storeId },
        });

        if (!parentProduct) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        if (parentProduct.conversionTargetId) {
            return NextResponse.json({ error: "Product already has a retail variant linked" }, { status: 400 });
        }

        // 2. Transaction: Create Child Product & Link Parent
        const result = await prisma.$transaction(async (tx: any) => {
            // Create Retail Product
            const newRetailProduct = await tx.product.create({
                data: {
                    name: `${parentProduct.name} (Eceran)`,
                    description: `Varian eceran dari ${parentProduct.name}`,
                    product_code: `${parentProduct.product_code || 'ECER'}-R${Math.floor(Math.random() * 100)}`, // Simple SKU generation
                    category: parentProduct.category,
                    price: parseFloat(retailPrice) || 0,
                    stock: 0,
                    unit: retailUnit,
                    supplierId: parentProduct.supplierId,
                    storeId: storeId,
                    // Optional: Copy other fields if needed
                    purchase_price: parentProduct.purchase_price ? (parentProduct.purchase_price / parseFloat(conversionRate)) : undefined,
                    min_selling_price: parentProduct.min_selling_price ? (parentProduct.min_selling_price / parseFloat(conversionRate)) : undefined,
                    batch_number: parentProduct.batch_number,
                    expiry_date: parentProduct.expiry_date,
                    purchase_date: parentProduct.purchase_date,
                },
            });

            // Update Parent with Link
            const updatedParent = await tx.product.update({
                where: { id: parentProductId },
                data: {
                    conversionTargetId: newRetailProduct.id,
                    conversionRate: parseFloat(conversionRate),
                },
            });

            return { parent: updatedParent, child: newRetailProduct };
        });

        return NextResponse.json({
            message: "Retail variant created successfully",
            details: result
        });

    } catch (error: any) {
        console.error("Setup Retail Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}, { requireStore: true });
