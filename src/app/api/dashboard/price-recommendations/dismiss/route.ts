// src/app/api/dashboard/price-recommendations/dismiss/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { dismissSchema } from "@/lib/validations/price-recommendation";

/**
 * POST /api/dashboard/price-recommendations/dismiss
 *
 * Records (or refreshes) a dismissal for a price recommendation. The dismissal
 * snapshots the product's current `purchase_price` so the GET endpoint can
 * re-show the recommendation when that purchase price changes.
 *
 * Idempotent: repeated calls for the same `(productId, dismissedAtPurchasePrice)`
 * tuple update only the `dismissedAt` timestamp via upsert.
 */
export const POST = withAuth(
  async (request: NextRequest, _session, storeId) => {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Body permintaan tidak valid", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      const parsed = dismissSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Body permintaan tidak valid", code: "INVALID_BODY" },
          { status: 400 }
        );
      }

      const { productId } = parsed.data;

      const product = await prisma.product.findFirst({
        where: { id: productId, storeId: storeId!, isDeleted: false },
        select: { purchase_price: true },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Produk tidak ditemukan", code: "PRODUCT_NOT_FOUND" },
          { status: 404 }
        );
      }

      // Sentinel `-1` for null purchase_price so the unique constraint and the
      // GET filter both work uniformly across products with no purchase price.
      const dismissedAtPurchasePrice = product.purchase_price ?? -1;
      const now = new Date();

      const dismissal = await prisma.priceRecommendationDismissal.upsert({
        where: {
          productId_dismissedAtPurchasePrice: {
            productId,
            dismissedAtPurchasePrice,
          },
        },
        update: { dismissedAt: now },
        create: {
          productId,
          storeId: storeId!,
          dismissedAtPurchasePrice,
          dismissedAt: now,
        },
      });

      return NextResponse.json({
        productId: dismissal.productId,
        dismissedAt: dismissal.dismissedAt,
        dismissedAtPurchasePrice: dismissal.dismissedAtPurchasePrice,
      });
    } catch (error) {
      console.error(
        "POST /api/dashboard/price-recommendations/dismiss error:",
        error
      );
      return NextResponse.json(
        { error: "Terjadi kesalahan internal", code: "INTERNAL" },
        { status: 500 }
      );
    }
  },
  { requireStore: true }
);
