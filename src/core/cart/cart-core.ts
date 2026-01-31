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

export interface CartProps {
    items: CartItemType[];
    onQuantityChange: (id: string, quantity: number) => void;
    onPriceChange: (id: string, price: number) => void;
    onRemove: (id: string) => void;
    onCheckout: () => void;
    onClear: () => void;
    className?: string;
    onCloseCart?: () => void;
    isPriceEditable?: boolean;
}

export interface CartState {
    isOpen: boolean;
    items: CartItemType[];
    isCheckout: boolean;
}

export interface CartSummary {
    totalItems: number;
    subtotal: number;
    totalQuantity: number;
}

export interface CartValidation {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_IS_PRICE_EDITABLE = true;
export const EMPTY_CART_MESSAGE = 'Keranjang belanja kosong';
export const EMPTY_CART_SUBTITLE = 'Tambahkan produk untuk memulai transaksi';
export const CART_TITLE = 'Keranjang Belanja';
export const ITEM_COUNT_SUFFIX = 'item';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create empty cart
 * Pure function - no side effects
 */
export function createEmptyCart(): CartItemType[] {
    return [];
}

/**
 * Create initial cart state
 * Pure function - no side effects
 */
export function createInitialCartState(): CartState {
    return {
        isOpen: false,
        items: [],
        isCheckout: false
    };
}

/**
 * Create default cart config
 * Pure function - no side effects
 */
export function createDefaultCartConfig(): { isPriceEditable: boolean; showCloseButton: boolean } {
    return {
        isPriceEditable: DEFAULT_IS_PRICE_EDITABLE,
        showCloseButton: true
    };
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate total items count
 * Pure function - no side effects
 */
export function calculateTotalItems(items: CartItemType[]): number {
    return items.length;
}

/**
 * Calculate subtotal
 * Pure function - no side effects
 */
export function calculateSubtotal(items: CartItemType[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Calculate total quantity (sum of all quantities)
 * Pure function - no side effects
 */
export function calculateTotalQuantity(items: CartItemType[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Calculate cart summary
 * Pure function - no side effects
 */
export function calculateCartSummary(items: CartItemType[]): CartSummary {
    return {
        totalItems: calculateTotalItems(items),
        subtotal: calculateSubtotal(items),
        totalQuantity: calculateTotalQuantity(items)
    };
}

/**
 * Calculate average price
 * Pure function - no side effects
 */
export function calculateAveragePrice(items: CartItemType[]): number {
    if (items.length === 0) return 0;
    return calculateSubtotal(items) / items.length;
}

/**
 * Calculate item total
 * Pure function - no side effects
 */
export function calculateItemTotal(item: CartItemType): number {
    return item.price * item.quantity;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set cart open state
 * Pure function - no side effects
 */
export function setCartOpen(current: CartState, isOpen: boolean): CartState {
    return { ...current, isOpen };
}

/**
 * Toggle cart open state
 * Pure function - no side effects
 */
export function toggleCartOpen(current: CartState): CartState {
    return { ...current, isOpen: !current.isOpen };
}

/**
 * Set cart items
 * Pure function - no side effects
 */
export function setCartItems(current: CartState, items: CartItemType[]): CartState {
    return { ...current, items };
}

/**
 * Add item to cart
 * Pure function - no side effects
 */
export function addCartItem(current: CartState, item: CartItemType): CartState {
    // Check if item already exists
    const existingIndex = current.items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
        // Update quantity of existing item
        const updatedItems = [...current.items];
        updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: updatedItems[existingIndex].quantity + item.quantity
        };
        return { ...current, items: updatedItems };
    }
    return { ...current, items: [...current.items, item] };
}

/**
 * Remove item from cart
 * Pure function - no side effects
 */
export function removeCartItem(current: CartState, itemId: string): CartState {
    return {
        ...current,
        items: current.items.filter(item => item.id !== itemId)
    };
}

/**
 * Update item quantity
 * Pure function - no side effects
 */
export function updateCartItemQuantity(current: CartState, itemId: string, quantity: number): CartState {
    return {
        ...current,
        items: current.items.map(item =>
            item.id === itemId ? { ...item, quantity } : item
        )
    };
}

/**
 * Update item price
 * Pure function - no side effects
 */
export function updateCartItemPrice(current: CartState, itemId: string, price: number): CartState {
    return {
        ...current,
        items: current.items.map(item =>
            item.id === itemId ? { ...item, price } : item
        )
    };
}

/**
 * Clear cart
 * Pure function - no side effects
 */
export function clearCart(current: CartState): CartState {
    return { ...current, items: [] };
}

/**
 * Set checkout state
 * Pure function - no side effects
 */
export function setCheckoutState(current: CartState, isCheckout: boolean): CartState {
    return { ...current, isCheckout };
}

/**
 * Reset cart state
 * Pure function - no side effects
 */
export function resetCartState(): CartState {
    return createInitialCartState();
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate cart for checkout
 * Pure function - no side effects
 */
export function validateCartForCheckout(items: CartItemType[]): CartValidation {
    const errors: string[] = [];
    
    if (items.length === 0) {
        errors.push('Keranjang kosong');
    }
    
    items.forEach(item => {
        if (item.quantity <= 0) {
            errors.push(`${item.name}: jumlah harus lebih dari 0`);
        }
        if (item.price < 0) {
            errors.push(`${item.name}: harga tidak valid`);
        }
    });
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if cart is empty
 * Pure function - no side effects
 */
export function isCartEmpty(items: CartItemType[]): boolean {
    return items.length === 0;
}

/**
 * Check if cart has items
 * Pure function - no side effects
 */
export function hasCartItems(items: CartItemType[]): boolean {
    return items.length > 0;
}

/**
 * Validate quantity change
 * Pure function - no side effects
 */
export function validateQuantityChange(item: CartItemType, newQuantity: number): { valid: boolean; error?: string } {
    if (newQuantity <= 0) {
        return { valid: false, error: 'Jumlah harus lebih dari 0' };
    }
    if (item.maxQuantity && newQuantity > item.maxQuantity) {
        return { valid: false, error: `Maksimal ${item.maxQuantity}` };
    }
    return { valid: true };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format subtotal for display
 * Pure function - no side effects
 */
export function formatSubtotal(subtotal: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(subtotal);
}

/**
 * Format total items count
 * Pure function - no side effects
 */
export function formatTotalItems(totalItems: number): string {
    return `${totalItems} ${ITEM_COUNT_SUFFIX}`;
}

/**
 * Get empty cart message
 * Pure function - no side effects
 */
export function getEmptyCartMessage(): { title: string; subtitle: string } {
    return {
        title: EMPTY_CART_MESSAGE,
        subtitle: EMPTY_CART_SUBTITLE
    };
}

/**
 * Get cart title with badge
 * Pure function - no side effects
 */
export function getCartTitle(totalItems: number): { title: string; showBadge: boolean } {
    return {
        title: CART_TITLE,
        showBadge: totalItems > 0
    };
}

/**
 * Format cart summary for display
 * Pure function - no side effects
 */
export function formatCartSummaryForDisplay(summary: CartSummary): string {
    return `${summary.totalItems} item | Total: ${formatSubtotal(summary.subtotal)}`;
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if items changed
 * Pure function - no side effects
 */
export function hasCartChanged(original: CartItemType[], current: CartItemType[]): boolean {
    if (original.length !== current.length) return true;
    return JSON.stringify(original) !== JSON.stringify(current);
}

/**
 * Find item by ID
 * Pure function - no side effects
 */
export function findCartItemById(items: CartItemType[], id: string): CartItemType | undefined {
    return items.find(item => item.id === id);
}

/**
 * Check if item exists in cart
 * Pure function - no side effects
 */
export function cartItemExists(items: CartItemType[], id: string): boolean {
    return items.some(item => item.id === id);
}

/**
 * Check if product exists in cart
 * Pure function - no side effects
 */
export function productInCart(items: CartItemType[], productId: string): boolean {
    return items.some(item => item.productId === productId);
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter items by product
 * Pure function - no side effects
 */
export function filterCartItemsByProduct(items: CartItemType[], productId: string): CartItemType[] {
    return items.filter(item => item.productId === productId);
}

/**
 * Filter items above price
 * Pure function - no side effects
 */
export function filterCartItemsAbovePrice(items: CartItemType[], price: number): CartItemType[] {
    return items.filter(item => item.price > price);
}

/**
 * Filter items with quantity above
 * Pure function - no side effects
 */
export function filterCartItemsAboveQuantity(items: CartItemType[], quantity: number): CartItemType[] {
    return items.filter(item => item.quantity > quantity);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort cart items by name
 * Pure function - no side effects
 */
export function sortCartItemsByName(items: CartItemType[], direction: 'asc' | 'desc' = 'asc'): CartItemType[] {
    return [...items].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return direction === 'asc' ? comparison : -comparison;
    });
}

/**
 * Sort cart items by price
 * Pure function - no side effects
 */
export function sortCartItemsByPrice(items: CartItemType[], direction: 'asc' | 'desc' = 'asc'): CartItemType[] {
    return [...items].sort((a, b) => {
        return direction === 'asc' ? a.price - b.price : b.price - a.price;
    });
}

/**
 * Sort cart items by quantity
 * Pure function - no side effects
 */
export function sortCartItemsByQuantity(items: CartItemType[], direction: 'asc' | 'desc' = 'desc'): CartItemType[] {
    return [...items].sort((a, b) => {
        return direction === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity;
    });
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Get cart statistics
 * Pure function - no side effects
 */
export function getCartStatistics(items: CartItemType[]): {
    totalItems: number;
    subtotal: number;
    totalQuantity: number;
    averagePrice: number;
    uniqueProducts: number;
    highestPricedItem: CartItemType | null;
    lowestPricedItem: CartItemType | null;
} {
    const summary = calculateCartSummary(items);
    const uniqueProducts = new Set(items.map(item => item.productId)).size;
    
    let highestPricedItem: CartItemType | null = null;
    let lowestPricedItem: CartItemType | null = null;
    
    if (items.length > 0) {
        highestPricedItem = [...items].sort((a, b) => b.price - a.price)[0];
        lowestPricedItem = [...items].sort((a, b) => a.price - b.price)[0];
    }
    
    return {
        ...summary,
        averagePrice: calculateAveragePrice(items),
        uniqueProducts,
        highestPricedItem,
        lowestPricedItem
    };
}

/**
 * Format cart statistics
 * Pure function - no side effects
 */
export function formatCartStatistics(stats: { totalItems: number; subtotal: number; totalQuantity: number }): string {
    return `Items: ${stats.totalItems} | Qty: ${stats.totalQuantity.toFixed(2)} | Total: ${formatSubtotal(stats.subtotal)}`;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare cart for export
 * Pure function - no side effects
 */
export function prepareCartExport(items: CartItemType[]): Array<Record<string, string>> {
    return items.map(item => ({
        'Nama': item.name,
        'Jumlah': `${item.quantity} ${item.unit}`,
        'Harga': formatSubtotal(item.price),
        'Total': formatSubtotal(item.price * item.quantity)
    }));
}

/**
 * Get cart class names
 * Pure function - no side effects
 */
export function getCartClassNames(compact?: boolean): string {
    const base = 'flex flex-col h-full sticky top-0';
    return compact ? `${base} compact` : base;
}

/**
 * Get checkout button text
 * Pure function - no side effects
 */
export function getCheckoutButtonText(subtotal: number): string {
    return `Bayar (${formatSubtotal(subtotal)})`;
}

/**
 * Get clear button text
 * Pure function - no side effects
 */
export function getClearButtonText(): string {
    return 'Hapus Semua';
}
