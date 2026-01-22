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

        // Ambil data produk sumber untuk cek stok & konfigurasi konversi
        const sourceProduct = await prisma.product.findUnique({
            where: { id: sourceProductId },
            include: { conversionTarget: true } // Pastikan ambil target produk
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

            // TODO: Catat di log transaksi/mutasi stok jika ada fiturnya (Optional for MVP)
        });

        return NextResponse.json({
            message: "Konversi berhasil",
            details: {
                source: sourceProduct.name,
                target: sourceProduct.conversionTarget?.name,
                convertedAmount: quantity,
                resultAmount: addedQuantity
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
