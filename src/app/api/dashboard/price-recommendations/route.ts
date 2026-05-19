// src/app/api/dashboard/price-recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { filterDismissed } from "@/lib/recommendation-filter";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Fetch all active products for the store and the dismissal records in
    // parallel. The dismissals are ordered by `dismissedAt desc` so we can
    // keep only the first row per `productId` to obtain the most recent
    // dismissal per product.
    const [products, dismissalRows] = await Promise.all([
      prisma.product.findMany({
        where: {
          storeId: storeId!,
          isDeleted: false,
          min_selling_price: { not: null }
        },
        select: {
          id: true,
          name: true,
          price: true,
          purchase_price: true,
          min_selling_price: true,
          hppCalculationDetails: true,
          unit: true
        }
      }),
      prisma.priceRecommendationDismissal.findMany({
        where: { storeId: storeId! },
        orderBy: { dismissedAt: "desc" },
        select: {
          productId: true,
          dismissedAtPurchasePrice: true
        }
      })
    ]);

    // Reduce to a Map<productId, latestDismissedAtPurchasePrice>, keeping
    // only the most recent row per productId. Since `dismissalRows` is
    // ordered by `dismissedAt desc`, the first row encountered for a given
    // productId is the most recent one.
    const latestDismissalByProductId = new Map<string, number>();
    for (const row of dismissalRows) {
      if (!latestDismissalByProductId.has(row.productId)) {
        latestDismissalByProductId.set(
          row.productId,
          row.dismissedAtPurchasePrice
        );
      }
    }

    // Shape the latest dismissals into the array form expected by
    // `filterDismissed`. The filter treats `null` `purchase_price` as the
    // sentinel `-1` on both sides.
    const latestDismissals = Array.from(
      latestDismissalByProductId,
      ([productId, dismissedAtPurchasePrice]) => ({
        productId,
        dismissedAtPurchasePrice
      })
    );

    const filteredProducts = filterDismissed(products, latestDismissals);

    const recommendations = [];

    for (const product of filteredProducts) {
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
      
      // Round up and down to nearest 1000
      const recommendedPriceUp = Math.ceil(rawRecommendedPrice / 1000) * 1000;
      const recommendedPriceDown = Math.floor(rawRecommendedPrice / 1000) * 1000;

      // If current price is strictly less than recommendedPriceUp, it needs an update
      if (product.price < recommendedPriceUp) {
        recommendations.push({
          id: product.id,
          name: product.name,
          currentPrice: product.price,
          rawRecommendedPrice,
          recommendedPriceUp,
          recommendedPriceDown,
          minSellingPrice: product.min_selling_price,
          retailMargin,
          unit: product.unit
        });
      }
    }

    // Sort by largest price difference (most urgent) based on round up
    recommendations.sort((a, b) => (b.recommendedPriceUp - b.currentPrice) - (a.recommendedPriceUp - a.currentPrice));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("GET /api/dashboard/price-recommendations error:", error);
    return NextResponse.json({ error: "Gagal mengambil rekomendasi harga" }, { status: 500 });
  }
}, { requireStore: true });
