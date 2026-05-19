// src/app/api/dashboard/price-recommendations/apply/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { applyPriceSchema } from "@/lib/validations/price-recommendation";
import { calculatePriceChange } from "@/lib/price-history";

/**
 * POST /api/dashboard/price-recommendations/apply
 *
 * Applies a system-recommended Selling_Price to a product. Replaces the legacy
 * direct call to PUT /api/products/[id] from the Price Recommendation Widget.
 *
 * Validates the payload via `applyPriceSchema`, then enforces business rules
 * tied to the product's stored `min_selling_price`. On success, atomically
 * updates `product.price` and inserts a `PriceHistory` row when the price
 * actually changed.
 *
 * Error codes follow the API error model in design.md:
 *   400 INVALID_BODY                  — Zod parse failure with no specific refinement
 *   400 NOT_MULTIPLE_OF_50            — price is not a multiple of 50
 *   400 ABOVE_MAX                     — price exceeds 999,999,999
 *   400 BELOW_MIN_SELLING_PRICE       — price is below product's min_selling_price
 *   400 MIN_SELLING_PRICE_UNAVAILABLE — product has null/0 min_selling_price
 *   404 PRODUCT_NOT_FOUND             — product missing, soft-deleted, or wrong store
 *   500 INTERNAL                      — unexpected failure (transaction rollback etc.)
 */
export const POST = withAuth(
  async (request: NextRequest, _session, storeId) => {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Body request tidak valid", code: "INVALID_BODY" },
          { status: 400 },
        );
      }

      const parsed = applyPriceSchema.safeParse(body);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((issue) => issue.message);
        if (messages.some((m) => m.includes("NOT_MULTIPLE_OF_50"))) {
          return NextResponse.json(
            { error: "Harga harus kelipatan 50", code: "NOT_MULTIPLE_OF_50" },
            { status: 400 },
          );
        }
        if (messages.some((m) => m.includes("ABOVE_MAX"))) {
          return NextResponse.json(
            { error: "Harga melebihi batas maksimum", code: "ABOVE_MAX" },
            { status: 400 },
          );
        }
        return NextResponse.json(
          { error: "Body request tidak valid", code: "INVALID_BODY" },
          { status: 400 },
        );
      }

      const { productId, price } = parsed.data;

      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          storeId: storeId!,
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
          price: true,
          min_selling_price: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Produk tidak ditemukan", code: "PRODUCT_NOT_FOUND" },
          { status: 404 },
        );
      }

      if (!product.min_selling_price || product.min_selling_price <= 0) {
        return NextResponse.json(
          {
            error: "Harga minimum tidak tersedia untuk produk ini",
            code: "MIN_SELLING_PRICE_UNAVAILABLE",
          },
          { status: 400 },
        );
      }

      if (price < product.min_selling_price) {
        return NextResponse.json(
          {
            error: `Harga tidak boleh di bawah harga minimum (Rp ${product.min_selling_price})`,
            code: "BELOW_MIN_SELLING_PRICE",
          },
          { status: 400 },
        );
      }

      const oldPrice = product.price;
      const newPrice = price;

      const updated = await prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { price: newPrice },
          select: {
            id: true,
            name: true,
            price: true,
            min_selling_price: true,
          },
        });

        if (oldPrice !== newPrice) {
          const change = calculatePriceChange(oldPrice, newPrice);
          await tx.priceHistory.create({
            data: {
              productId,
              storeId: storeId!,
              priceType: "SELLING",
              oldPrice,
              newPrice,
              changeAmount: change.changeAmount,
              changePercentage: change.changePercentage,
              source: "MANUAL_EDIT",
            },
          });
        }

        return updatedProduct;
      });

      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        price: updated.price,
        min_selling_price: updated.min_selling_price,
      });
    } catch (error) {
      console.error("POST /api/dashboard/price-recommendations/apply error:", error);
      return NextResponse.json(
        { error: "Terjadi kesalahan saat menerapkan harga rekomendasi", code: "INTERNAL" },
        { status: 500 },
      );
    }
  },
  { requireStore: true },
);
