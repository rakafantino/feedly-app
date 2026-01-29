import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
    try {
        // Validasi sesi
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sourceProductId, quantity } = await request.json();

        if (!sourceProductId || !quantity || quantity <= 0) {
            return NextResponse.json(
                { error: "Data konversi tidak valid" },
                { status: 400 }
            );
        }

        const storeId = session.user.storeId;

        if (!storeId) {
             return NextResponse.json({ error: "Store ID unavailable" }, { status: 400 });
        }

        // Ambil data produk sumber untuk cek stok & konfigurasi konversi
        const sourceProduct = await prisma.product.findFirst({
            where: { 
                id: sourceProductId,
                storeId: storeId 
            },
            include: { 
                conversionTarget: true,
                batches: {
                    where: { stock: { gt: 0 } },  // Filter batch dengan stok > 0
                    orderBy: [
                        { expiryDate: 'asc' },   // FEFO: Expiry terdekat dulu
                        { inDate: 'asc' }        // Fallback: FIFO
                    ]
                }
            }
        });

        if (!sourceProduct) {
            return NextResponse.json(
                { error: "Produk sumber tidak ditemukan" },
                { status: 404 }
            );
        }

        if (!sourceProduct.conversionTargetId || !sourceProduct.conversionRate) {
            return NextResponse.json(
                { error: "Produk ini tidak memiliki konfigurasi konversi satuan" },
                { status: 400 }
            );
        }

        if (sourceProduct.stock < quantity) {
            return NextResponse.json(
                { error: `Stok tidak cukup. Tersedia: ${sourceProduct.stock} ${sourceProduct.unit}` },
                { status: 400 }
            );
        }

        // Hitung jumlah yang akan ditambahkan ke produk target
        const addedQuantity = quantity * sourceProduct.conversionRate;

        // Track batch info yang digunakan untuk response
        const usedBatches: { batchNumber: string | null; quantity: number; expiryDate: Date | null }[] = [];

        // Lakukan transaksi database
        await prisma.$transaction(async (tx: any) => {
            // 1. Kurangi stok produk sumber (Grosir/Karung)
            await tx.product.update({
                where: { id: sourceProductId },
                data: { stock: { decrement: quantity } }
            });

            // 2. Tambah stok produk target (Ecer/Kg)
            await tx.product.update({
                where: { id: sourceProduct.conversionTargetId },
                data: { stock: { increment: addedQuantity } }
            });

            // 3. Deduct dari batch sumber (FEFO) dan buat batch baru untuk target
            let remainingToConvert = quantity;
            const sourceBatches = sourceProduct.batches;

            // Jika tidak ada batch di produk sumber, buat batch target dengan info dari produk
            if (sourceBatches.length === 0) {
                const sourceCost = sourceProduct.hpp_price || sourceProduct.purchase_price || 0;
                const unitCost = sourceProduct.conversionRate ? sourceCost / sourceProduct.conversionRate : 0;

                await tx.productBatch.create({
                    data: {
                        productId: sourceProduct.conversionTargetId,
                        batchNumber: `CONV-${Date.now()}`,
                        stock: addedQuantity,
                        purchasePrice: unitCost,
                        expiryDate: sourceProduct.expiry_date,
                        inDate: new Date(),
                    }
                });

                usedBatches.push({
                    batchNumber: `CONV-${Date.now()}`,
                    quantity: quantity,
                    expiryDate: sourceProduct.expiry_date
                });
            } else {
                // Proses batch sumber (FEFO)
                for (const batch of sourceBatches) {
                    if (remainingToConvert <= 0) break;

                    const deductFromBatch = Math.min(batch.stock, remainingToConvert);
                    const convertedRetailQty = deductFromBatch * sourceProduct.conversionRate!;

                    // Kurangi batch sumber
                    await tx.productBatch.update({
                        where: { id: batch.id },
                        data: { stock: { decrement: deductFromBatch } }
                    });

                    // Hitung cost per unit eceran dari batch ini
                    // Use batch.purchasePrice OR sourceProduct.hpp_price as fallback
                    const batchCost = batch.purchasePrice || sourceProduct.hpp_price || sourceProduct.purchase_price || 0;
                    const unitCost = sourceProduct.conversionRate ? batchCost / sourceProduct.conversionRate : 0;

                    // Buat batch baru untuk produk target dengan info dari batch sumber
                    const retailBatchNumber = batch.batchNumber 
                        ? `${batch.batchNumber}-RETAIL` 
                        : `CONV-${Date.now()}`;

                    await tx.productBatch.create({
                        data: {
                            productId: sourceProduct.conversionTargetId,
                            batchNumber: retailBatchNumber,  // Inherit batch number
                            stock: convertedRetailQty,
                            purchasePrice: unitCost,
                            expiryDate: batch.expiryDate,  // Inherit expiry dari batch sumber
                            inDate: new Date(),
                        }
                    });

                    usedBatches.push({
                        batchNumber: batch.batchNumber,
                        quantity: deductFromBatch,
                        expiryDate: batch.expiryDate
                    });

                    remainingToConvert -= deductFromBatch;
                }
            }
        });

        return NextResponse.json({
            message: "Konversi berhasil",
            details: {
                source: sourceProduct.name,
                target: sourceProduct.conversionTarget?.name,
                convertedAmount: quantity,
                resultAmount: addedQuantity,
                usedBatches: usedBatches
            }
        });

    } catch (error) {
        console.error("Conversion Error:", error);
        return NextResponse.json(
            { error: "Terjadi kesalahan saat memproses konversi" },
            { status: 500 }
        );
    }
}
