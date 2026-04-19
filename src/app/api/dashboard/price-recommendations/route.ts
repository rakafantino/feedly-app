// src/app/api/dashboard/price-recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Fetch all active products for the store
    const products = await prisma.product.findMany({
      where: { 
        storeId: storeId!,
        isDeleted: false,
        min_selling_price: { not: null }
      },
      select: {
        id: true,
        name: true,
        price: true,
        min_selling_price: true,
        hppCalculationDetails: true,
        unit: true
      }
    });

    const recommendations = [];

    for (const product of products) {
      if (!product.min_selling_price) continue;

      // Extract retail margin from hppCalculationDetails or default to 10%
      let retailMargin = 10;
      if (product.hppCalculationDetails && typeof product.hppCalculationDetails === 'object') {
        const details = product.hppCalculationDetails as any;
        if (details.retailMargin !== undefined) {
          retailMargin = parseFloat(details.retailMargin);
        }
      }

      // Calculate recommended price: min_selling_price + (min_selling_price * retailMargin / 100)
      const rawRecommendedPrice = product.min_selling_price + (product.min_selling_price * (retailMargin / 100));
      
      // Round up to nearest 1000
      const recommendedPrice = Math.ceil(rawRecommendedPrice / 1000) * 1000;

      // If current price is strictly less than recommended price, it needs an update
      if (product.price < recommendedPrice) {
        recommendations.push({
          id: product.id,
          name: product.name,
          currentPrice: product.price,
          recommendedPrice,
          minSellingPrice: product.min_selling_price,
          retailMargin,
          unit: product.unit
        });
      }
    }

    // Sort by largest price difference (most urgent)
    recommendations.sort((a, b) => (b.recommendedPrice - b.currentPrice) - (a.recommendedPrice - a.currentPrice));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("GET /api/dashboard/price-recommendations error:", error);
    return NextResponse.json({ error: "Gagal mengambil rekomendasi harga" }, { status: 500 });
  }
}, { requireStore: true });
