// ============================================================================
// TYPES
// ============================================================================

export interface CartItemType {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  maxQuantity?: number | null;
}

export interface CartItemInput {
  value: string;
  isEditing: boolean;
}

export interface PriceInput {
  value: string;
  isEditing: boolean;
}

export interface CartItemValidation {
  valid: boolean;
  quantityError?: string;
  priceError?: string;
}

export interface CartItemState {
  quantity: number;
  inputValue: string;
  isEditing: boolean;
  isEditingPrice: boolean;
  priceInputValue: string;
  price: number;
}

export interface CartItemConfig {
  isPriceEditable: boolean;
  minQuantity: number;
  maxPrice: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_MIN_QUANTITY = 0.01;
export const DEFAULT_MIN_PRICE = 0;
export const DEFAULT_IS_PRICE_EDITABLE = true;
export const DECIMAL_REGEX = /^\d*\.?\d*$/;
export const EMPTY_INPUT = "";

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create empty cart item
 * Pure function - no side effects
 */
export function createEmptyCartItem(): CartItemType {
  return {
    id: "",
    productId: "",
    name: "",
    price: 0,
    quantity: 0,
    unit: "",
  };
}

/**
 * Create initial cart item state
 * Pure function - no side effects
 */
export function createInitialCartItemState(item: CartItemType): CartItemState {
  return {
    quantity: item.quantity,
    inputValue: item.quantity.toString(),
    isEditing: false,
    isEditingPrice: false,
    priceInputValue: item.price.toString(),
    price: item.price,
  };
}

/**
 * Create initial input state
 * Pure function - no side effects
 */
export function createInitialInputState(value: string): CartItemInput {
  return {
    value,
    isEditing: false,
  };
}

/**
 * Create initial price input state
 * Pure function - no side effects
 */
export function createInitialPriceInputState(value: string): PriceInput {
  return {
    value,
    isEditing: false,
  };
}

/**
 * Create default config
 * Pure function - no side effects
 */
export function createDefaultConfig(): CartItemConfig {
  return {
    isPriceEditable: DEFAULT_IS_PRICE_EDITABLE,
    minQuantity: DEFAULT_MIN_QUANTITY,
    maxPrice: DEFAULT_MIN_PRICE,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate quantity
 * Pure function - no side effects
 */
export function validateQuantity(value: number, minQuantity: number = DEFAULT_MIN_QUANTITY, maxQuantity?: number): { valid: boolean; error?: string; value: number } {
  if (isNaN(value)) {
    return { valid: false, error: "Jumlah tidak valid", value: minQuantity };
  }

  if (value < minQuantity) {
    return { valid: false, error: `Jumlah minimal ${minQuantity}`, value: minQuantity };
  }

  if (maxQuantity && value > maxQuantity) {
    return { valid: false, error: `Maksimal ${maxQuantity}`, value: maxQuantity };
  }

  return { valid: true, value };
}

/**
 * Validate price
 * Pure function - no side effects
 */
export function validatePrice(value: number, minPrice: number = DEFAULT_MIN_PRICE): { valid: boolean; error?: string; value: number } {
  if (isNaN(value)) {
    return { valid: false, error: "Harga tidak valid", value: minPrice };
  }

  if (value < minPrice) {
    return { valid: false, error: `Harga minimal ${minPrice}`, value: minPrice };
  }

  return { valid: true, value };
}

/**
 * Validate input string
 * Pure function - no side effects
 */
export function validateInputString(value: string): { valid: boolean; error?: string } {
  if (value === "") {
    return { valid: true };
  }

  if (!DECIMAL_REGEX.test(value)) {
    return { valid: false, error: "Format tidak valid" };
  }

  return { valid: true };
}

/**
 * Validate complete cart item
 * Pure function - no side effects
 */
export function validateCartItem(item: CartItemType): CartItemValidation {
  const quantityResult = validateQuantity(item.quantity);
  const priceResult = validatePrice(item.price);

  return {
    valid: quantityResult.valid && priceResult.valid,
    quantityError: quantityResult.error,
    priceError: priceResult.error,
  };
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate item total
 * Pure function - no side effects
 */
export function calculateItemTotal(price: number, quantity: number): number {
  return price * quantity;
}

/**
 * Calculate quantity increment
 * Pure function - no side effects
 */
export function calculateNextQuantity(currentQuantity: number, increment: number, maxQuantity?: number): number {
  const next = currentQuantity + increment;
  if (maxQuantity && next > maxQuantity) return maxQuantity;
  return next;
}

/**
 * Parse quantity from string
 * Pure function - no side effects
 */
export function parseQuantity(input: string, defaultValue: number = DEFAULT_MIN_QUANTITY): number {
  if (input === "" || input === ".") return defaultValue;
  const parsed = parseFloat(input);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse price from string
 * Pure function - no side effects
 */
export function parsePrice(input: string, defaultValue: number = DEFAULT_MIN_PRICE): number {
  if (input === "" || input === ".") return defaultValue;
  const parsed = parseFloat(input);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set editing mode for quantity
 * Pure function - no side effects
 */
export function setQuantityEditing(current: CartItemState, isEditing: boolean): CartItemState {
  return { ...current, isEditing };
}

/**
 * Set quantity input value
 * Pure function - no side effects
 */
export function setQuantityInput(current: CartItemState, value: string): CartItemState {
  return { ...current, inputValue: value };
}

/**
 * Set quantity
 * Pure function - no side effects
 */
export function setQuantity(current: CartItemState, quantity: number): CartItemState {
  return { ...current, quantity, inputValue: quantity.toString() };
}

/**
 * Set editing mode for price
 * Pure function - no side effects
 */
export function setPriceEditing(current: CartItemState, isEditing: boolean): CartItemState {
  return { ...current, isEditingPrice: isEditing };
}

/**
 * Set price input value
 * Pure function - no side effects
 */
export function setPriceInput(current: CartItemState, value: string): CartItemState {
  return { ...current, priceInputValue: value };
}

/**
 * Set price
 * Pure function - no side effects
 */
export function setPrice(current: CartItemState, price: number): CartItemState {
  return { ...current, price: price, priceInputValue: price.toString() };
}

/**
 * Reset state from item
 * Pure function - no side effects
 */
export function resetState(current: CartItemState, item: CartItemType): CartItemState {
  return {
    quantity: item.quantity,
    inputValue: item.quantity.toString(),
    isEditing: false,
    isEditingPrice: false,
    priceInputValue: item.price.toString(),
    price: item.price,
  };
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if quantity changed
 * Pure function - no side effects
 */
export function hasQuantityChanged(original: CartItemType, newQuantity: number): boolean {
  return original.quantity !== newQuantity;
}

/**
 * Check if price changed
 * Pure function - no side effects
 */
export function hasPriceChanged(original: CartItemType, newPrice: number): boolean {
  return original.price !== newPrice;
}

/**
 * Check if item changed
 * Pure function - no side effects
 */
export function hasItemChanged(original: CartItemType, updated: Partial<CartItemType>): boolean {
  return original.quantity !== updated.quantity || original.price !== updated.price;
}

/**
 * Find item by ID
 * Pure function - no side effects
 */
export function findItemById(items: CartItemType[], id: string): CartItemType | undefined {
  return items.find((item) => item.id === id);
}

/**
 * Check if item exists
 * Pure function - no side effects
 */
export function itemExists(items: CartItemType[], id: string): boolean {
  return items.some((item) => item.id === id);
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format quantity for display
 * Pure function - no side effects
 */
export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2);
}

/**
 * Format price for display
 * Pure function - no side effects
 */
export function formatItemPrice(price: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format item total for display
 * Pure function - no side effects
 */
export function formatItemTotal(price: number, quantity: number): string {
  return formatItemPrice(price * quantity);
}

/**
 * Format quantity with unit
 * Pure function - no side effects
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  return `${formatQuantity(quantity)} ${unit}`;
}

/**
 * Get item display text
 * Pure function - no side effects
 */
export function getItemDisplay(item: CartItemType): { name: string; quantity: string; price: string; total: string } {
  return {
    name: item.name,
    quantity: formatQuantityWithUnit(item.quantity, item.unit),
    price: formatItemPrice(item.price),
    total: formatItemTotal(item.price, item.quantity),
  };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter items by product ID
 * Pure function - no side effects
 */
export function filterByProductId(items: CartItemType[], productId: string): CartItemType[] {
  return items.filter((item) => item.productId === productId);
}

/**
 * Filter items with quantity above threshold
 * Pure function - no side effects
 */
export function filterAboveQuantity(items: CartItemType[], threshold: number): CartItemType[] {
  return items.filter((item) => item.quantity > threshold);
}

/**
 * Filter items with price above threshold
 * Pure function - no side effects
 */
export function filterAbovePrice(items: CartItemType[], threshold: number): CartItemType[] {
  return items.filter((item) => item.price > threshold);
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Get cart item summary
 * Pure function - no side effects
 */
export function getCartItemSummary(items: CartItemType[]): {
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  uniqueProducts: number;
} {
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const uniqueProducts = new Set(items.map((item) => item.productId)).size;

  return { totalItems, totalQuantity, subtotal, uniqueProducts };
}

/**
 * Format cart item summary
 * Pure function - no side effects
 */
export function formatCartItemSummary(summary: { totalItems: number; totalQuantity: number; subtotal: number }): string {
  return `${summary.totalItems} item | ${summary.totalQuantity.toFixed(2)} unit | Subtotal: ${formatItemPrice(summary.subtotal)}`;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare items for export
 * Pure function - no side effects
 */
export function prepareCartItemsExport(items: CartItemType[]): Array<Record<string, string>> {
  return items.map((item) => ({
    Nama: item.name,
    Jumlah: formatQuantityWithUnit(item.quantity, item.unit),
    Harga: formatItemPrice(item.price),
    Total: formatItemTotal(item.price, item.quantity),
  }));
}

/**
 * Get max quantity label
 * Pure function - no side effects
 */
export function getMaxQuantityLabel(maxQuantity?: number | null): string {
  if (!maxQuantity) return "";
  return `Max: ${maxQuantity}`;
}
