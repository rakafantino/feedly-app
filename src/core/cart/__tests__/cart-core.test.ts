/**
 * TDD Tests for cart-core.ts
 */

import {
    // Constants
    DEFAULT_IS_PRICE_EDITABLE,
    EMPTY_CART_MESSAGE,
    EMPTY_CART_SUBTITLE,
    CART_TITLE,
    ITEM_COUNT_SUFFIX,
    
    // Initialization
    createEmptyCart,
    createInitialCartState,
    createDefaultCartConfig,
    
    // Calculations
    calculateTotalItems,
    calculateSubtotal,
    calculateTotalQuantity,
    calculateCartSummary,
    calculateAveragePrice,
    calculateItemTotal,
    
    // State Management
    setCartOpen,
    toggleCartOpen,
    setCartItems,
    addCartItem,
    removeCartItem,
    updateCartItemQuantity,
    updateCartItemPrice,
    clearCart,
    setCheckoutState,
    resetCartState,
    
    // Validation
    validateCartForCheckout,
    isCartEmpty,
    hasCartItems,
    validateQuantityChange,
    
    // Formatting
    formatSubtotal,
    formatTotalItems,
    getEmptyCartMessage,
    getCartTitle,
    formatCartSummaryForDisplay,
    
    // Comparison
    hasCartChanged,
    findCartItemById,
    cartItemExists,
    productInCart,
    
    // Filtering
    filterCartItemsByProduct,
    filterCartItemsAbovePrice,
    filterCartItemsAboveQuantity,
    
    // Sorting
    sortCartItemsByName,
    sortCartItemsByPrice,
    sortCartItemsByQuantity,
    
    // Summary
    getCartStatistics,
    formatCartStatistics,
    
    // Export
    prepareCartExport,
    getCartClassNames,
    getCheckoutButtonText,
    getClearButtonText
} from '../cart-core';
import { CartItemType, CartState, CartSummary, CartValidation } from '../cart-core';

describe('Constants', () => {
    it('has correct DEFAULT_IS_PRICE_EDITABLE', () => {
        expect(DEFAULT_IS_PRICE_EDITABLE).toBe(true);
    });
    
    it('has correct messages', () => {
        expect(EMPTY_CART_MESSAGE).toBe('Keranjang belanja kosong');
        expect(EMPTY_CART_SUBTITLE).toBe('Tambahkan produk untuk memulai transaksi');
        expect(CART_TITLE).toBe('Keranjang Belanja');
    });
});

describe('createEmptyCart', () => {
    it('creates empty array', () => {
        const result = createEmptyCart();
        expect(result).toEqual([]);
    });
});

describe('createInitialCartState', () => {
    it('creates initial state', () => {
        const result = createInitialCartState();
        expect(result.isOpen).toBe(false);
        expect(result.items).toEqual([]);
        expect(result.isCheckout).toBe(false);
    });
});

describe('createDefaultCartConfig', () => {
    it('creates default config', () => {
        const result = createDefaultCartConfig();
        expect(result.isPriceEditable).toBe(true);
        expect(result.showCloseButton).toBe(true);
    });
});

describe('calculateTotalItems', () => {
    it('calculates total', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 200, quantity: 3, unit: 'pcs' }
        ];
        expect(calculateTotalItems(items)).toBe(2);
    });
    
    it('returns 0 for empty cart', () => {
        expect(calculateTotalItems([])).toBe(0);
    });
});

describe('calculateSubtotal', () => {
    it('calculates subtotal', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 5000, quantity: 3, unit: 'pcs' }
        ];
        expect(calculateSubtotal(items)).toBe(35000);
    });
});

describe('calculateTotalQuantity', () => {
    it('calculates total quantity', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 200, quantity: 3, unit: 'pcs' }
        ];
        expect(calculateTotalQuantity(items)).toBe(5);
    });
});

describe('calculateCartSummary', () => {
    it('returns summary', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }
        ];
        const result = calculateCartSummary(items);
        expect(result.totalItems).toBe(1);
        expect(result.subtotal).toBe(20000);
        expect(result.totalQuantity).toBe(2);
    });
});

describe('calculateAveragePrice', () => {
    it('calculates average based on subtotal and items count', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 2, unit: 'pcs' }
        ];
        // Subtotal = 60000, Items = 2, Average = 60000 / 2 = 30000
        expect(calculateAveragePrice(items)).toBe(30000);
    });
    
    it('returns 0 for empty cart', () => {
        expect(calculateAveragePrice([])).toBe(0);
    });
});

describe('calculateItemTotal', () => {
    it('calculates item total', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' };
        expect(calculateItemTotal(item)).toBe(20000);
    });
});

describe('setCartOpen', () => {
    it('sets cart open', () => {
        const state = createInitialCartState();
        const result = setCartOpen(state, true);
        expect(result.isOpen).toBe(true);
    });
    
    it('sets cart closed', () => {
        const state = { ...createInitialCartState(), isOpen: true };
        const result = setCartOpen(state, false);
        expect(result.isOpen).toBe(false);
    });
});

describe('toggleCartOpen', () => {
    it('toggles open state', () => {
        const state = createInitialCartState();
        const result = toggleCartOpen(state);
        expect(result.isOpen).toBe(true);
        
        const result2 = toggleCartOpen(result);
        expect(result2.isOpen).toBe(false);
    });
});

describe('setCartItems', () => {
    it('sets cart items', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }
        ];
        const state = createInitialCartState();
        const result = setCartItems(state, items);
        expect(result.items).toEqual(items);
    });
});

describe('addCartItem', () => {
    it('adds new item', () => {
        const state = createInitialCartState();
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = addCartItem(state, item);
        expect(result.items.length).toBe(1);
    });
    
    it('updates quantity for existing item', () => {
        const state: CartState = {
            isOpen: true,
            items: [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }],
            isCheckout: false
        };
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 3, unit: 'pcs' };
        const result = addCartItem(state, item);
        expect(result.items[0].quantity).toBe(5);
    });
});

describe('removeCartItem', () => {
    it('removes item', () => {
        const state: CartState = {
            isOpen: true,
            items: [
                { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
                { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 3, unit: 'pcs' }
            ],
            isCheckout: false
        };
        const result = removeCartItem(state, '1');
        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe('2');
    });
});

describe('updateCartItemQuantity', () => {
    it('updates quantity', () => {
        const state: CartState = {
            isOpen: true,
            items: [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }],
            isCheckout: false
        };
        const result = updateCartItemQuantity(state, '1', 5);
        expect(result.items[0].quantity).toBe(5);
    });
});

describe('updateCartItemPrice', () => {
    it('updates price', () => {
        const state: CartState = {
            isOpen: true,
            items: [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }],
            isCheckout: false
        };
        const result = updateCartItemPrice(state, '1', 15000);
        expect(result.items[0].price).toBe(15000);
    });
});

describe('clearCart', () => {
    it('clears all items', () => {
        const state: CartState = {
            isOpen: true,
            items: [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }],
            isCheckout: false
        };
        const result = clearCart(state);
        expect(result.items).toEqual([]);
    });
});

describe('setCheckoutState', () => {
    it('sets checkout state', () => {
        const state = createInitialCartState();
        const result = setCheckoutState(state, true);
        expect(result.isCheckout).toBe(true);
    });
});

describe('resetCartState', () => {
    it('resets to initial', () => {
        const state: CartState = {
            isOpen: true,
            items: [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }],
            isCheckout: true
        };
        const result = resetCartState();
        expect(result).toEqual(createInitialCartState());
    });
});

describe('validateCartForCheckout', () => {
    it('validates valid cart', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }
        ];
        const result = validateCartForCheckout(items);
        expect(result.valid).toBe(true);
    });
    
    it('returns error for empty cart', () => {
        const result = validateCartForCheckout([]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Keranjang');
    });
    
    it('returns error for invalid quantity', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 0, unit: 'pcs' }
        ];
        const result = validateCartForCheckout(items);
        expect(result.valid).toBe(false);
    });
});

describe('isCartEmpty', () => {
    it('returns true for empty cart', () => {
        expect(isCartEmpty([])).toBe(true);
    });
    
    it('returns false for non-empty cart', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(isCartEmpty(items)).toBe(false);
    });
});

describe('hasCartItems', () => {
    it('returns true for non-empty cart', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(hasCartItems(items)).toBe(true);
    });
    
    it('returns false for empty cart', () => {
        expect(hasCartItems([])).toBe(false);
    });
});

describe('validateQuantityChange', () => {
    it('validates valid quantity', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = validateQuantityChange(item, 5);
        expect(result.valid).toBe(true);
    });
    
    it('returns error for zero quantity', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = validateQuantityChange(item, 0);
        expect(result.valid).toBe(false);
    });
    
    it('returns error for exceeding max', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs', maxQuantity: 10 };
        const result = validateQuantityChange(item, 15);
        expect(result.valid).toBe(false);
    });
});

describe('formatSubtotal', () => {
    it('formats subtotal', () => {
        const result = formatSubtotal(50000);
        expect(result).toContain('50');
        expect(result).toContain('000');
    });
});

describe('formatTotalItems', () => {
    it('formats total items', () => {
        expect(formatTotalItems(5)).toBe('5 item');
    });
});

describe('getEmptyCartMessage', () => {
    it('returns empty cart message', () => {
        const result = getEmptyCartMessage();
        expect(result.title).toBe('Keranjang belanja kosong');
        expect(result.subtitle).toBe('Tambahkan produk untuk memulai transaksi');
    });
});

describe('getCartTitle', () => {
    it('returns title with badge', () => {
        const result = getCartTitle(5);
        expect(result.title).toBe('Keranjang Belanja');
        expect(result.showBadge).toBe(true);
    });
    
    it('returns title without badge for zero', () => {
        const result = getCartTitle(0);
        expect(result.showBadge).toBe(false);
    });
});

describe('formatCartSummaryForDisplay', () => {
    it('formats summary', () => {
        const summary: CartSummary = { totalItems: 3, subtotal: 75000, totalQuantity: 7 };
        const result = formatCartSummaryForDisplay(summary);
        expect(result).toContain('3 item');
        expect(result).toContain('Total:');
    });
});

describe('hasCartChanged', () => {
    it('detects changes', () => {
        const original: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        const current: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 3, unit: 'pcs' }];
        expect(hasCartChanged(original, current)).toBe(true);
    });
    
    it('detects no changes for same content', () => {
        const items1: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        const items2: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(hasCartChanged(items1, items2)).toBe(false);
    });
});

describe('findCartItemById', () => {
    it('finds item', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 3, unit: 'pcs' }
        ];
        expect(findCartItemById(items, '2')?.name).toBe('B');
    });
});

describe('cartItemExists', () => {
    it('returns true if exists', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(cartItemExists(items, '1')).toBe(true);
    });
    
    it('returns false if not exists', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(cartItemExists(items, '2')).toBe(false);
    });
});

describe('productInCart', () => {
    it('returns true if product in cart', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(productInCart(items, 'p1')).toBe(true);
    });
    
    it('returns false if product not in cart', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' }];
        expect(productInCart(items, 'p2')).toBe(false);
    });
});

describe('filterCartItemsByProduct', () => {
    it('filters by product ID', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 3, unit: 'pcs' }
        ];
        expect(filterCartItemsByProduct(items, 'p1').length).toBe(1);
    });
});

describe('sortCartItemsByName', () => {
    it('sorts by name', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'Zebra', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'Apple', price: 20000, quantity: 3, unit: 'pcs' }
        ];
        const result = sortCartItemsByName(items, 'asc');
        expect(result[0].name).toBe('Apple');
    });
});

describe('sortCartItemsByPrice', () => {
    it('sorts by price', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 20000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 10000, quantity: 3, unit: 'pcs' }
        ];
        const result = sortCartItemsByPrice(items, 'asc');
        expect(result[0].price).toBe(10000);
    });
});

describe('sortCartItemsByQuantity', () => {
    it('sorts by quantity', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 5, unit: 'pcs' }
        ];
        const result = sortCartItemsByQuantity(items, 'desc');
        expect(result[0].quantity).toBe(5);
    });
});

describe('getCartStatistics', () => {
    it('returns statistics', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 20000, quantity: 3, unit: 'pcs' }
        ];
        // Subtotal = 10000*2 + 20000*3 = 20000 + 60000 = 80000
        const result = getCartStatistics(items);
        expect(result.totalItems).toBe(2);
        expect(result.subtotal).toBe(80000);
        expect(result.uniqueProducts).toBe(2);
    });
});

describe('formatCartStatistics', () => {
    it('formats statistics', () => {
        const stats = { totalItems: 3, subtotal: 75000, totalQuantity: 7.5 };
        const result = formatCartStatistics(stats);
        expect(result).toContain('Items: 3');
        expect(result).toContain('Total:');
    });
});

describe('prepareCartExport', () => {
    it('prepares export data', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'Product A', price: 10000, quantity: 2, unit: 'pcs' }
        ];
        const result = prepareCartExport(items);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('Product A');
    });
});

describe('getCartClassNames', () => {
    it('returns class names', () => {
        expect(getCartClassNames()).toContain('flex flex-col');
        expect(getCartClassNames(true)).toContain('compact');
    });
});

describe('getCheckoutButtonText', () => {
    it('returns button text', () => {
        expect(getCheckoutButtonText(50000)).toContain('50');
        expect(getCheckoutButtonText(50000)).toContain('Bayar');
    });
});

describe('getClearButtonText', () => {
    it('returns clear button text', () => {
        expect(getClearButtonText()).toBe('Hapus Semua');
    });
});
