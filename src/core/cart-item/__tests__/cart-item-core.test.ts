/**
 * TDD Tests for cart-item-core.ts
 */

import {
    // Constants
    DEFAULT_MIN_QUANTITY,
    DEFAULT_MIN_PRICE,
    DEFAULT_IS_PRICE_EDITABLE,
    DECIMAL_REGEX,
    EMPTY_INPUT,
    
    // Initialization
    createEmptyCartItem,
    createInitialCartItemState,
    createInitialInputState,
    createInitialPriceInputState,
    createDefaultConfig,
    
    // Validation
    validateQuantity,
    validatePrice,
    validateInputString,
    validateCartItem,
    
    // Calculations
    calculateItemTotal,
    calculateNextQuantity,
    parseQuantity,
    parsePrice,
    
    // State Management
    setQuantityEditing,
    setQuantityInput,
    setQuantity,
    setPriceEditing,
    setPriceInput,
    setPrice,
    resetState,
    
    // Comparison
    hasQuantityChanged,
    hasPriceChanged,
    hasItemChanged,
    findItemById,
    itemExists,
    
    // Formatting
    formatQuantity,
    formatItemPrice,
    formatItemTotal,
    formatQuantityWithUnit,
    getItemDisplay,
    
    // Filtering
    filterByProductId,
    filterAboveQuantity,
    filterAbovePrice,
    
    // Summary
    getCartItemSummary,
    formatCartItemSummary,
    
    // Export
    prepareCartItemsExport,
    getMaxQuantityLabel
} from '../cart-item-core';
import { CartItemType, CartItemState, CartItemValidation, CartItemConfig } from '../cart-item-core';

describe('Constants', () => {
    it('has correct DEFAULT_MIN_QUANTITY', () => {
        expect(DEFAULT_MIN_QUANTITY).toBe(1);
    });
    
    it('has correct DEFAULT_MIN_PRICE', () => {
        expect(DEFAULT_MIN_PRICE).toBe(0);
    });
    
    it('has correct DECIMAL_REGEX', () => {
        expect(DECIMAL_REGEX.test('1.5')).toBe(true);
        expect(DECIMAL_REGEX.test('100')).toBe(true);
        expect(DECIMAL_REGEX.test('abc')).toBe(false);
    });
});

describe('createEmptyCartItem', () => {
    it('creates empty cart item', () => {
        const result = createEmptyCartItem();
        expect(result.id).toBe('');
        expect(result.productId).toBe('');
        expect(result.name).toBe('');
        expect(result.price).toBe(0);
        expect(result.quantity).toBe(0);
    });
});

describe('createInitialCartItemState', () => {
    it('creates state from item', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'Product A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = createInitialCartItemState(item);
        expect(result.quantity).toBe(2);
        expect(result.inputValue).toBe('2');
        expect(result.isEditing).toBe(false);
    });
});

describe('createInitialInputState', () => {
    it('creates input state', () => {
        const result = createInitialInputState('2.5');
        expect(result.value).toBe('2.5');
        expect(result.isEditing).toBe(false);
    });
});

describe('createInitialPriceInputState', () => {
    it('creates price input state', () => {
        const result = createInitialPriceInputState('10000');
        expect(result.value).toBe('10000');
        expect(result.isEditing).toBe(false);
    });
});

describe('createDefaultConfig', () => {
    it('creates default config', () => {
        const result = createDefaultConfig();
        expect(result.isPriceEditable).toBe(true);
        expect(result.minQuantity).toBe(1);
        expect(result.maxPrice).toBe(0);
    });
});

describe('validateQuantity', () => {
    it('validates valid quantity', () => {
        const result = validateQuantity(5);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(5);
    });
    
    it('returns error for zero', () => {
        const result = validateQuantity(0);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('minimal');
    });
    
    it('returns error for negative', () => {
        const result = validateQuantity(-1);
        expect(result.valid).toBe(false);
    });
    
    it('returns error for exceeding max', () => {
        const result = validateQuantity(15, 1, 10);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Maksimal');
    });
    
    it('clamps to max quantity', () => {
        const result = validateQuantity(15, 1, 10);
        expect(result.value).toBe(10);
    });
});

describe('validatePrice', () => {
    it('validates valid price', () => {
        const result = validatePrice(10000);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(10000);
    });
    
    it('returns error for negative', () => {
        const result = validatePrice(-100);
        expect(result.valid).toBe(false);
    });
    
    it('clamps to min price', () => {
        const result = validatePrice(-100, 0);
        expect(result.value).toBe(0);
    });
});

describe('validateInputString', () => {
    it('validates empty string', () => {
        const result = validateInputString('');
        expect(result.valid).toBe(true);
    });
    
    it('validates decimal number', () => {
        const result = validateInputString('2.5');
        expect(result.valid).toBe(true);
    });
    
    it('rejects invalid format', () => {
        const result = validateInputString('abc');
        expect(result.valid).toBe(false);
    });
});

describe('validateCartItem', () => {
    it('validates valid item', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'Product A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = validateCartItem(item);
        expect(result.valid).toBe(true);
    });
    
    it('returns errors for invalid item', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'Product A', price: -100, quantity: 0, unit: 'pcs' };
        const result = validateCartItem(item);
        expect(result.valid).toBe(false);
    });
});

describe('calculateItemTotal', () => {
    it('calculates total', () => {
        expect(calculateItemTotal(10000, 2)).toBe(20000);
    });
    
    it('handles decimal', () => {
        expect(calculateItemTotal(10000, 0.5)).toBe(5000);
    });
    
    it('handles zero', () => {
        expect(calculateItemTotal(10000, 0)).toBe(0);
    });
});

describe('calculateNextQuantity', () => {
    it('increments quantity', () => {
        expect(calculateNextQuantity(2, 1)).toBe(3);
    });
    
    it('decrements quantity', () => {
        expect(calculateNextQuantity(2, -1)).toBe(1);
    });
    
    it('respects max quantity', () => {
        expect(calculateNextQuantity(9, 1, 10)).toBe(10);
    });
});

describe('parseQuantity', () => {
    it('parses valid number', () => {
        expect(parseQuantity('2.5')).toBe(2.5);
    });
    
    it('parses integer', () => {
        expect(parseQuantity('10')).toBe(10);
    });
    
    it('returns default for empty', () => {
        expect(parseQuantity('')).toBe(1);
    });
    
    it('returns default for dot', () => {
        expect(parseQuantity('.')).toBe(1);
    });
    
    it('returns default for invalid', () => {
        expect(parseQuantity('abc')).toBe(1);
    });
});

describe('parsePrice', () => {
    it('parses valid price', () => {
        expect(parsePrice('10000')).toBe(10000);
    });
    
    it('returns default for empty', () => {
        expect(parsePrice('')).toBe(0);
    });
});

describe('setQuantityEditing', () => {
    it('sets editing state', () => {
        const state: CartItemState = { quantity: 2, inputValue: '2', isEditing: false, isEditingPrice: false, priceInputValue: '10000', price: 10000 };
        const result = setQuantityEditing(state, true);
        expect(result.isEditing).toBe(true);
    });
});

describe('setQuantityInput', () => {
    it('sets input value', () => {
        const state = createInitialCartItemState({ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' });
        const result = setQuantityInput(state, '5');
        expect(result.inputValue).toBe('5');
    });
});

describe('setQuantity', () => {
    it('sets quantity and input', () => {
        const state = createInitialCartItemState({ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' });
        const result = setQuantity(state, 5);
        expect(result.quantity).toBe(5);
        expect(result.inputValue).toBe('5');
    });
});

describe('setPriceEditing', () => {
    it('sets price editing state', () => {
        const state = createInitialCartItemState({ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' });
        const result = setPriceEditing(state, true);
        expect(result.isEditingPrice).toBe(true);
    });
});

describe('setPriceInput', () => {
    it('sets price input value', () => {
        const state = createInitialCartItemState({ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' });
        const result = setPriceInput(state, '15000');
        expect(result.priceInputValue).toBe('15000');
    });
});

describe('setPrice', () => {
    it('sets price and input', () => {
        const state = createInitialCartItemState({ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' });
        const result = setPrice(state, 15000);
        expect(result.price).toBe(15000);
        expect(result.priceInputValue).toBe('15000');
    });
});

describe('resetState', () => {
    it('resets from item', () => {
        const state: CartItemState = { quantity: 10, inputValue: '10', isEditing: true, isEditingPrice: true, priceInputValue: '20000', price: 20000 };
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        const result = resetState(state, item);
        expect(result.quantity).toBe(2);
        expect(result.isEditing).toBe(false);
    });
});

describe('hasQuantityChanged', () => {
    it('detects change', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasQuantityChanged(item, 5)).toBe(true);
    });
    
    it('detects no change', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasQuantityChanged(item, 2)).toBe(false);
    });
});

describe('hasPriceChanged', () => {
    it('detects change', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasPriceChanged(item, 150)).toBe(true);
    });
    
    it('detects no change', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasPriceChanged(item, 100)).toBe(false);
    });
});

describe('hasItemChanged', () => {
    it('detects changes', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasItemChanged(item, { quantity: 5 })).toBe(true);
    });
    
    it('detects changes when empty object passed (undefined values)', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        // When comparing with undefined, it's considered a change
        expect(hasItemChanged(item, {})).toBe(true);
    });
    
    it('detects no changes when same values passed', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' };
        expect(hasItemChanged(item, { quantity: 2, price: 100 })).toBe(false);
    });
});

describe('findItemById', () => {
    it('finds item', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 200, quantity: 3, unit: 'pcs' }
        ];
        expect(findItemById(items, '2')?.name).toBe('B');
    });
    
    it('returns undefined for not found', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' }];
        expect(findItemById(items, '3')).toBeUndefined();
    });
});

describe('itemExists', () => {
    it('returns true if exists', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' }];
        expect(itemExists(items, '1')).toBe(true);
    });
    
    it('returns false if not exists', () => {
        const items: CartItemType[] = [{ id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' }];
        expect(itemExists(items, '2')).toBe(false);
    });
});

describe('formatQuantity', () => {
    it('formats integer', () => {
        expect(formatQuantity(5)).toBe('5');
    });
    
    it('formats decimal', () => {
        expect(formatQuantity(2.5)).toBe('2.50');
    });
});

describe('formatItemPrice', () => {
    it('formats price', () => {
        const result = formatItemPrice(50000);
        expect(result).toContain('50');
        expect(result).toContain('000');
    });
});

describe('formatItemTotal', () => {
    it('formats total', () => {
        const result = formatItemTotal(10000, 2);
        expect(result).toContain('20');
        expect(result).toContain('000');
    });
});

describe('formatQuantityWithUnit', () => {
    it('formats with unit', () => {
        expect(formatQuantityWithUnit(2, 'pcs')).toBe('2 pcs');
    });
    
    it('formats decimal with unit', () => {
        expect(formatQuantityWithUnit(0.5, 'kg')).toBe('0.50 kg');
    });
});

describe('getItemDisplay', () => {
    it('returns display object', () => {
        const item: CartItemType = { id: '1', productId: 'p1', name: 'Product A', price: 10000, quantity: 2, unit: 'pcs' };
        const result = getItemDisplay(item);
        expect(result.name).toBe('Product A');
        expect(result.quantity).toContain('2');
        expect(result.total).toContain('20');
    });
});

describe('filterByProductId', () => {
    it('filters by product ID', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 200, quantity: 3, unit: 'pcs' }
        ];
        expect(filterByProductId(items, 'p1').length).toBe(1);
    });
});

describe('filterAboveQuantity', () => {
    it('filters above threshold', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 100, quantity: 10, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 200, quantity: 5, unit: 'pcs' }
        ];
        expect(filterAboveQuantity(items, 7).length).toBe(1);
    });
});

describe('filterAbovePrice', () => {
    it('filters above price threshold', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 5000, quantity: 3, unit: 'pcs' }
        ];
        expect(filterAbovePrice(items, 7000).length).toBe(1);
    });
});

describe('getCartItemSummary', () => {
    it('returns summary', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'A', price: 10000, quantity: 2, unit: 'pcs' },
            { id: '2', productId: 'p2', name: 'B', price: 5000, quantity: 3, unit: 'pcs' }
        ];
        const result = getCartItemSummary(items);
        expect(result.totalItems).toBe(2);
        expect(result.totalQuantity).toBe(5);
        expect(result.subtotal).toBe(35000);
        expect(result.uniqueProducts).toBe(2);
    });
});

describe('formatCartItemSummary', () => {
    it('formats summary', () => {
        const summary = { totalItems: 3, totalQuantity: 7.5, subtotal: 75000 };
        const result = formatCartItemSummary(summary);
        expect(result).toContain('3 item');
        expect(result).toContain('Subtotal');
    });
});

describe('prepareCartItemsExport', () => {
    it('prepares export data', () => {
        const items: CartItemType[] = [
            { id: '1', productId: 'p1', name: 'Product A', price: 10000, quantity: 2, unit: 'pcs' }
        ];
        const result = prepareCartItemsExport(items);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('Product A');
        expect(result[0]['Jumlah']).toContain('2');
    });
});

describe('getMaxQuantityLabel', () => {
    it('returns empty for null', () => {
        expect(getMaxQuantityLabel(null)).toBe('');
    });
    
    it('returns label for max', () => {
        expect(getMaxQuantityLabel(10)).toBe('Max: 10');
    });
});
