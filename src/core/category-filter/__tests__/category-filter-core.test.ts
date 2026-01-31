/**
 * Tests for category-filter-core.ts
 */

import {
    DEFAULT_ALL_LABEL,
    createEmptyCategories,
    createDefaultAllCategory,
    filterCategories,
    sortCategories,
    validateCategoryId,
    formatCategoryCount,
    getCategoryDisplay,
    selectCategory,
    deselectCategory,
    toggleCategory,
    getCategorySummary,
    prepareCategoriesExport
} from '../category-filter-core';

describe('Constants', () => {
    it('has correct DEFAULT_ALL_LABEL', () => {
        expect(DEFAULT_ALL_LABEL).toBe('Semua');
    });
});

describe('createEmptyCategories', () => {
    it('creates empty array', () => {
        expect(createEmptyCategories()).toEqual([]);
    });
});

describe('createDefaultAllCategory', () => {
    it('creates all category', () => {
        const result = createDefaultAllCategory();
        expect(result.id).toBe('all');
        expect(result.name).toBe('Semua');
    });
});

describe('filterCategories', () => {
    it('filters by search term', () => {
        const categories = [
            { id: '1', name: 'Electronics' },
            { id: '2', name: 'Clothing' }
        ];
        expect(filterCategories(categories, 'elec').length).toBe(1);
    });
    
    it('returns all for empty search', () => {
        const categories = [
            { id: '1', name: 'Electronics' },
            { id: '2', name: 'Clothing' }
        ];
        expect(filterCategories(categories, '').length).toBe(2);
    });
});

describe('sortCategories', () => {
    it('sorts ascending', () => {
        const categories = [
            { id: '1', name: 'Zebra' },
            { id: '2', name: 'Apple' }
        ];
        const result = sortCategories(categories, 'asc');
        expect(result[0].name).toBe('Apple');
    });
});

describe('validateCategoryId', () => {
    it('validates all', () => {
        expect(validateCategoryId([], 'all')).toBe(true);
    });
    
    it('validates existing category', () => {
        const categories = [{ id: '1', name: 'Electronics' }];
        expect(validateCategoryId(categories, '1')).toBe(true);
    });
    
    it('invalidates non-existing', () => {
        const categories = [{ id: '1', name: 'Electronics' }];
        expect(validateCategoryId(categories, '2')).toBe(false);
    });
});

describe('formatCategoryCount', () => {
    it('formats count', () => {
        expect(formatCategoryCount(5)).toBe('(5)');
    });
    
    it('returns empty for undefined', () => {
        expect(formatCategoryCount(undefined)).toBe('');
    });
});

describe('getCategoryDisplay', () => {
    it('formats with count', () => {
        expect(getCategoryDisplay({ id: '1', name: 'Electronics', count: 10 }, true)).toBe('Electronics(10)');
    });
    
    it('formats without count', () => {
        expect(getCategoryDisplay({ id: '1', name: 'Electronics' }, false)).toBe('Electronics');
    });
});

describe('selectCategory', () => {
    it('selects category', () => {
        expect(selectCategory(undefined, '1')).toBe('1');
    });
    
    it('returns undefined for all', () => {
        expect(selectCategory(undefined, 'all')).toBeUndefined();
    });
});

describe('deselectCategory', () => {
    it('deselects category', () => {
        expect(deselectCategory('1')).toBeUndefined();
    });
});

describe('toggleCategory', () => {
    it('toggles on', () => {
        expect(toggleCategory(undefined, '1')).toBe('1');
    });
    
    it('toggles off', () => {
        expect(toggleCategory('1', '1')).toBeUndefined();
    });
});

describe('getCategorySummary', () => {
    it('returns summary', () => {
        const categories = [
            { id: '1', name: 'Electronics', count: 10 },
            { id: '2', name: 'Clothing', count: 15 }
        ];
        const result = getCategorySummary(categories);
        expect(result).toContain('2 kategori');
        expect(result).toContain('25 produk');
    });
});

describe('prepareCategoriesExport', () => {
    it('prepares export', () => {
        const categories = [{ id: '1', name: 'Electronics', count: 10 }];
        const result = prepareCategoriesExport(categories);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('Electronics');
        expect(result[0]['Jumlah']).toBe('10');
    });
});
