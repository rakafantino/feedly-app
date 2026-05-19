// src/app/api/dashboard/price-recommendations/custom/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { customPriceSchema } from "@/lib/validations/price-recommendation";
import {
  isValidCustomPrice,
  calculateRetailMarginFromCustomPrice,
} from "@/core/price-calculator/price-calculator-core";
import { mergeRetailMargin, roundTo2 } from "@/lib/hpp-merge";
import { calculatePriceChange } from "@/lib/price-history";

/**
 * POST /api/dashboard/price-recommendations/custom
 *
 * Applies a user-supplied Custom_Price (Selling_Price) to a product and
 * back-calculates the new `retailMargin` so future recommendations track
 * the user's pricing decision.
 *
 * Atomically updates `product.price` and merges the new `retailMargin` into
 * `hppCalculationDetails` (preserving `costs`, `safetyMargin`, and any other
 * pre-existing keys). When the Selling_Price actually changes, also inserts
 * a `PriceHistory` row with `priceType: 'SELLING'`, `source: 'MANUAL_EDIT'`.
 *
 * `min_selling_price` is NEVER modified by this endpoint — Requirements 3.2,
 * 4.6, 4.7.
 *
 * Error codes follow the API error model in design.md:
 *   400 INVALID_BODY                  — Zod parse failure with no specific refinement
 *   400 NOT_MULTIPLE_OF_50            — customPrice is not a multiple of 50
 *   400 ABOVE_MAX                     — customPrice exceeds 999,999,999
 *   400 BELOW_MIN_SELLING_PRICE       — customPrice is below product's min_selling_price
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

      const parsed = customPriceSchema.safeParse(body);
      if (!parsed.success) {
        // The schema attaches stable codes as the `message` of each issue.
        // Inspect the first issue and map known codes; everything else is INVALID_BODY.
        const firstMessage = parsed.error.issues[0]?.message;
        if (firstMessage === "NOT_MULTIPLE_OF_50") {
          return NextResponse.json(
            { error: "Harga harus kelipatan 50", code: "NOT_MULTIPLE_OF_50" },
            { status: 400 },
          );
        }
        if (firstMessage === "ABOVE_MAX") {
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

      const { productId, customPrice } = parsed.data;

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
          hppCalculationDetails: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Produk tidak ditemukan", code: "PRODUCT_NOT_FOUND" },
          { status: 404 },
        );
      }

      // MIN_SELLING_PRICE_UNAVAILABLE is checked BEFORE invoking isValidCustomPrice
      // so we never even attempt a back-calculation against a missing denominator.
      if (!product.min_selling_price || product.min_selling_price <= 0) {
        return NextResponse.json(
          {
            error: "Harga minimum tidak tersedia untuk produk ini",
            code: "MIN_SELLING_PRICE_UNAVAILABLE",
          },
          { status: 400 },
        );
      }

      const validation = isValidCustomPrice(
        customPrice,
        product.min_selling_price,
      );
      if (!validation.valid) {
        switch (validation.error) {
          case "BELOW_MIN_SELLING_PRICE":
            return NextResponse.json(
              {
                error: `Harga tidak boleh di bawah harga minimum (Rp ${product.min_selling_price})`,
                code: "BELOW_MIN_SELLING_PRICE",
              },
              { status: 400 },
            );
          case "NOT_MULTIPLE_OF_50":
            return NextResponse.json(
              { error: "Harga harus kelipatan 50", code: "NOT_MULTIPLE_OF_50" },
              { status: 400 },
            );
          case "ABOVE_MAX":
            return NextResponse.json(
              { error: "Harga melebihi batas maksimum", code: "ABOVE_MAX" },
              { status: 400 },
            );
          default:
            // NOT_FINITE / NOT_INTEGER / NEGATIVE should have been caught by the
            // Zod schema already; treat any leftover as a generic invalid body.
            return NextResponse.json(
              { error: "Body request tidak valid", code: "INVALID_BODY" },
              { status: 400 },
            );
        }
      }

      const oldPrice = product.price;

      // Defensive try/catch around the back-calculation: the
      // MIN_SELLING_PRICE_UNAVAILABLE check above guarantees we never reach
      // here with a zero/null denominator, but if any future refactor breaks
      // that invariant we surface it as INTERNAL rather than a 500 stack trace.
      let newMargin: number;
      try {
        newMargin = calculateRetailMarginFromCustomPrice(
          customPrice,
          product.min_selling_price,
        );
      } catch (err) {
        console.error(
          "POST /api/dashboard/price-recommendations/custom: back-calc failed",
          err,
        );
        return NextResponse.json(
          { error: "Gagal menghitung margin", code: "INTERNAL" },
          { status: 500 },
        );
      }

      const mergedDetails = mergeRetailMargin(
        product.hppCalculationDetails,
        newMargin,
      );

      const updated = await prisma.$transaction(async (tx) => {
        // CRITICAL: data must contain ONLY `price` and `hppCalculationDetails`.
        // `min_selling_price` is intentionally omitted to satisfy Requirements
        // 3.2 / 4.6 / 4.7 — the stored Min_Selling_Price MUST remain unchanged.
        const updatedProduct = await tx.product.update({
          where: { id: productId, storeId: storeId! },
          data: {
            price: customPrice,
            hppCalculationDetails: mergedDetails as Prisma.InputJsonValue,
          },
          select: {
            id: true,
            name: true,
            price: true,
            min_selling_price: true,
          },
        });

        if (oldPrice !== customPrice) {
          const change = calculatePriceChange(oldPrice, customPrice);
          await tx.priceHistory.create({
            data: {
              productId,
              storeId: storeId!,
              priceType: "SELLING",
              oldPrice,
              newPrice: customPrice,
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
        retailMargin: roundTo2(newMargin),
      });
    } catch (error) {
      console.error(
        "POST /api/dashboard/price-recommendations/custom error:",
        error,
      );
      return NextResponse.json(
        { error: "Terjadi kesalahan saat menyimpan harga kustom", code: "INTERNAL" },
        { status: 500 },
      );
    }
  },
  { requireStore: true },
);
