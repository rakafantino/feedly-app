import { z } from 'zod';

/**
 * Validation schemas for the dynamic price recommendation API endpoints.
 *
 * Error messages on each constraint double as machine-readable codes so the
 * route handler can map ZodError issues to the API error model documented
 * in design.md (e.g. NOT_MULTIPLE_OF_50, ABOVE_MAX). The handler should
 * inspect each `ZodIssue.message` (and/or `params.code`) to produce the
 * appropriate HTTP response code.
 *
 * Note: BELOW_MIN_SELLING_PRICE and MIN_SELLING_PRICE_UNAVAILABLE are NOT
 * encoded here because they depend on the product's stored Min_Selling_Price
 * which is only known server-side after the product lookup. Those checks
 * happen in the route handler via `isValidCustomPrice`.
 */

const MAX_PRICE = 999_999_999;
const ROUNDING = 50;

/**
 * Custom error codes attached via `params.code` so the route handler can
 * identify the exact violation without string-matching messages.
 */
export const PriceRecommendationErrorCode = {
  NOT_FINITE: 'NOT_FINITE',
  NOT_INTEGER: 'NOT_INTEGER',
  NEGATIVE: 'NEGATIVE',
  ABOVE_MAX: 'ABOVE_MAX',
  NOT_MULTIPLE_OF_50: 'NOT_MULTIPLE_OF_50',
  PRODUCT_ID_REQUIRED: 'PRODUCT_ID_REQUIRED',
} as const;

export type PriceRecommendationErrorCode =
  (typeof PriceRecommendationErrorCode)[keyof typeof PriceRecommendationErrorCode];

const productIdField = z
  .string({ required_error: 'PRODUCT_ID_REQUIRED' })
  .min(1, { message: 'PRODUCT_ID_REQUIRED' });

/**
 * A non-negative integer price in IDR, capped at MAX_PRICE and constrained to
 * multiples of ROUNDING (50). Each constraint uses a stable error code as its
 * message so the route handler can map issues to API error codes.
 */
const priceField = z
  .number({ invalid_type_error: 'NOT_FINITE' })
  .finite({ message: 'NOT_FINITE' })
  .int({ message: 'NOT_INTEGER' })
  .min(0, { message: 'NEGATIVE' })
  .max(MAX_PRICE, { message: 'ABOVE_MAX' })
  .refine((value) => value % ROUNDING === 0, {
    message: 'NOT_MULTIPLE_OF_50',
    params: { code: PriceRecommendationErrorCode.NOT_MULTIPLE_OF_50 },
  });

export const applyPriceSchema = z.object({
  productId: productIdField,
  price: priceField,
});

export const customPriceSchema = z.object({
  productId: productIdField,
  customPrice: priceField,
});

export const dismissSchema = z.object({
  productId: productIdField,
});

export type ApplyPriceInput = z.infer<typeof applyPriceSchema>;
export type CustomPriceInput = z.infer<typeof customPriceSchema>;
export type DismissInput = z.infer<typeof dismissSchema>;
