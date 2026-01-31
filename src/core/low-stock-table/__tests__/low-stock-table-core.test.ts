/**
 * TDD Tests for low-stock-table-core.ts
 */

import {
    // Constants
    DEFAULT_SORT_COLUMN,
    DEFAULT_SORT_DIRECTION,
    STATUS_FILTERS,
    DEFAULT_CATEGORY,
    GROUP_TYPES,
    
    // Initialization
    createInitialSortConfig,
    createInitialFilterConfig,
    createInitialTableState,
    createExpandedGroups,
    
    // Sorting
    sortProducts,
    toggleSort,
    setSort,
    
    // Filtering
    filterBySearchTerm,
    filterByCategory,
    filterByStatus,
    filterProducts,
    
    // Grouping
    categorizeProductType,
    groupBySupplier,
    getRetailProducts,
    getSupplierProducts,
    createProductGroups,
    filterAndGroupProducts,
    
    // Selection
    toggleProductSelection,
    toggleGroupSelection,
    selectAllInGroup,
    clearSelections,
    getSelectedProducts,
    
    // Expansion
    toggleExpansion,
    setExpansion,
    expandAllGroups,
    collapseAllGroups,
    
    // Validation
    validateSearchTerm,
    validateCategoryFilter,
    
    // Formatting
    getCategories,
    getGroupCountSummary,
    getSelectedCountSummary,
    formatProductDisplay,
    
    // Summary
    getLowStockSummary,
    formatLowStockSummary,
    
    // State Management
    updateSearchTerm,
    updateCategoryFilter,
    updateStatusFilter,
    toggleFilters,
    resetFilters,
    
    // Export
    prepareProductsExport,
    prepareGroupsExport
} from '../low-stock-table-core';
import { Product, ProductGroup, SortConfig, FilterConfig, TableState } from '../low-stock-table-core';

describe('Constants', () => {
    it('has correct defaults', () => {
        expect(DEFAULT_SORT_COLUMN).toBe('name');
        expect(DEFAULT_SORT_DIRECTION).toBe('asc');
        expect(DEFAULT_CATEGORY).toBe('all');
    });
    
    it('has STATUS_FILTERS', () => {
        expect(STATUS_FILTERS.ALL).toBe('all');
        expect(STATUS_FILTERS.OUT_OF_STOCK).toBe('out_of_stock');
        expect(STATUS_FILTERS.LOW_STOCK).toBe('low_stock');
    });
    
    it('has GROUP_TYPES', () => {
        expect(GROUP_TYPES.SUPPLIER).toBe('supplier');
        expect(GROUP_TYPES.RETAIL).toBe('retail');
        expect(GROUP_TYPES.OTHER).toBe('other');
    });
});

describe('createInitialSortConfig', () => {
    it('creates initial config', () => {
        const result = createInitialSortConfig();
        expect(result.column).toBe('name');
        expect(result.direction).toBe('asc');
    });
});

describe('createInitialFilterConfig', () => {
    it('creates initial filter config', () => {
        const result = createInitialFilterConfig();
        expect(result.searchTerm).toBe('');
        expect(result.category).toBe('all');
        expect(result.status).toBe('all');
    });
});

describe('createInitialTableState', () => {
    it('creates initial table state', () => {
        const result = createInitialTableState();
        expect(result.sortColumn).toBe('name');
        expect(result.searchTerm).toBe('');
        expect(result.categoryFilter).toBe('all');
        expect(result.statusFilter).toBe('all');
        expect(result.expandedGroups).toEqual({});
        expect(result.selectedProducts).toEqual({});
    });
});

describe('createExpandedGroups', () => {
    it('creates expanded groups', () => {
        const groups: ProductGroup[] = [
            { id: '1', name: 'Group 1', type: 'supplier', products: [] },
            { id: '2', name: 'Group 2', type: 'retail', products: [] }
        ];
        const result = createExpandedGroups(groups);
        expect(result['1']).toBe(true);
        expect(result['2']).toBe(true);
    });
});

describe('sortProducts', () => {
    const products: Product[] = [
        { id: '1', name: 'Apple', price: 100, stock: 10, category: 'Fruit' },
        { id: '2', name: 'Banana', price: 50, stock: 5, category: 'Fruit' },
        { id: '3', name: 'Carrot', price: 30, stock: 20, category: 'Vegetable' }
    ];
    
    it('sorts by name asc', () => {
        const result = sortProducts(products, 'name', 'asc');
        expect(result[0].name).toBe('Apple');
        expect(result[1].name).toBe('Banana');
        expect(result[2].name).toBe('Carrot');
    });
    
    it('sorts by name desc', () => {
        const result = sortProducts(products, 'name', 'desc');
        expect(result[0].name).toBe('Carrot');
        expect(result[1].name).toBe('Banana');
        expect(result[2].name).toBe('Apple');
    });
    
    it('sorts by stock', () => {
        const result = sortProducts(products, 'stock', 'asc');
        expect(result[0].stock).toBe(5);
        expect(result[2].stock).toBe(20);
    });
    
    it('sorts by price', () => {
        const result = sortProducts(products, 'price', 'asc');
        expect(result[0].price).toBe(30);
        expect(result[2].price).toBe(100);
    });
});

describe('toggleSort', () => {
    it('toggles direction for same column', () => {
        const current: SortConfig = { column: 'name', direction: 'asc' };
        const result = toggleSort(current, 'name');
        expect(result.column).toBe('name');
        expect(result.direction).toBe('desc');
    });
    
    it('resets direction for new column', () => {
        const current: SortConfig = { column: 'name', direction: 'desc' };
        const result = toggleSort(current, 'stock');
        expect(result.column).toBe('stock');
        expect(result.direction).toBe('asc');
    });
});

describe('setSort', () => {
    it('sets sort column and direction', () => {
        const result = setSort(createInitialSortConfig(), 'stock', 'desc');
        expect(result.column).toBe('stock');
        expect(result.direction).toBe('desc');
    });
});

describe('filterBySearchTerm', () => {
    const products: Product[] = [
        { id: '1', name: 'Apple', price: 100, stock: 10 },
        { id: '2', name: 'Banana', price: 50, stock: 5 },
        { id: '3', name: 'Orange', price: 30, stock: 20 }
    ];
    
    it('returns all for empty search', () => {
        const result = filterBySearchTerm(products, '');
        expect(result.length).toBe(3);
    });
    
    it('filters by search term', () => {
        const result = filterBySearchTerm(products, 'app');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Apple');
    });
    
    it('is case insensitive', () => {
        const result = filterBySearchTerm(products, 'APPLE');
        expect(result.length).toBe(1);
    });
});

describe('filterByCategory', () => {
    const products: Product[] = [
        { id: '1', name: 'Apple', category: 'Fruit', price: 100, stock: 10 },
        { id: '2', name: 'Carrot', category: 'Vegetable', price: 50, stock: 5 }
    ];
    
    it('returns all for all category', () => {
        const result = filterByCategory(products, 'all');
        expect(result.length).toBe(2);
    });
    
    it('filters by category', () => {
        const result = filterByCategory(products, 'Fruit');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Apple');
    });
});

describe('filterByStatus', () => {
    const products: Product[] = [
        { id: '1', name: 'Apple', stock: 0, price: 10000, category: 'Fruit', threshold: 5 },
        { id: '2', name: 'Banana', stock: 5, price: 5000, category: 'Fruit', threshold: 5 },
        { id: '3', name: 'Orange', stock: 10, price: 8000, category: 'Fruit', threshold: 5 }
    ];
    
    it('returns all for all status', () => {
        const result = filterByStatus(products, 'all');
        expect(result.length).toBe(3);
    });
    
    it('filters out of stock', () => {
        const result = filterByStatus(products, 'out_of_stock');
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Apple');
    });
    
    it('filters low stock', () => {
        const result = filterByStatus(products, 'low_stock');
        expect(result.length).toBe(2);
    });
});

describe('filterProducts', () => {
    const products: Product[] = [
        { id: '1', name: 'Apple', category: 'Fruit', stock: 0, price: 10000, threshold: 5 },
        { id: '2', name: 'Banana', category: 'Fruit', stock: 5, price: 5000, threshold: 5 },
        { id: '3', name: 'Carrot', category: 'Vegetable', stock: 10, price: 3000, threshold: 5 }
    ];
    
    it('filters with all criteria', () => {
        const config: FilterConfig = { searchTerm: 'app', category: 'Fruit', status: 'all' };
        const result = filterProducts(products, config);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Apple');
    });
    
    it('handles empty search', () => {
        const config: FilterConfig = { searchTerm: '', category: 'all', status: 'all' };
        const result = filterProducts(products, config);
        expect(result.length).toBe(3);
    });
});

describe('categorizeProductType', () => {
    it('returns retail for converted products', () => {
        const product: Product = { id: '1', name: 'Test', price: 100, stock: 10, convertedFrom: ['parent-1'] };
        expect(categorizeProductType(product)).toBe('retail');
    });
    
    it('returns supplier for products with supplierId', () => {
        const product: Product = { id: '1', name: 'Test', price: 100, stock: 10, supplierId: 'sup-1' };
        expect(categorizeProductType(product)).toBe('supplier');
    });
    
    it('returns other for other products', () => {
        const product: Product = { id: '1', name: 'Test', price: 100, stock: 10 };
        expect(categorizeProductType(product)).toBe('other');
    });
});

describe('groupBySupplier', () => {
    it('groups products by supplier', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, supplierId: 'sup-1' },
            { id: '2', name: 'B', price: 100, stock: 10, supplierId: 'sup-2' },
            { id: '3', name: 'C', price: 100, stock: 10, supplierId: 'sup-1' }
        ];
        const result = groupBySupplier(products);
        expect(result['sup-1'].length).toBe(2);
        expect(result['sup-2'].length).toBe(1);
    });
    
    it('uses no-supplier for products without supplier', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10 },
            { id: '2', name: 'B', price: 100, stock: 10, supplierId: null as any }
        ];
        const result = groupBySupplier(products);
        expect(result['no-supplier'].length).toBe(2);
    });
});

describe('getRetailProducts', () => {
    it('returns retail products', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, convertedFrom: ['parent-1'] },
            { id: '2', name: 'B', price: 100, stock: 10 },
            { id: '3', name: 'C', price: 100, stock: 10, convertedFrom: ['parent-2'] }
        ];
        const result = getRetailProducts(products);
        expect(result.length).toBe(2);
    });
});

describe('getSupplierProducts', () => {
    it('returns products with supplier and not retail', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, convertedFrom: ['parent-1'] },
            { id: '2', name: 'B', price: 100, stock: 10, supplierId: 'sup-1' },
            { id: '3', name: 'C', price: 100, stock: 10 }
        ];
        const result = getSupplierProducts(products);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('B');
    });
});

describe('createProductGroups', () => {
    it('creates groups', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, supplierId: 'sup-1', supplier: { id: 'sup-1', name: 'Supplier A' } as any },
            { id: '2', name: 'B', price: 100, stock: 10, supplierId: 'sup-2', supplier: { id: 'sup-2', name: 'Supplier B' } as any },
            { id: '3', name: 'C', price: 100, stock: 10, convertedFrom: ['parent-1'] }
        ];
        const result = createProductGroups(products);
        expect(result.length).toBe(3);
        expect(result.find(g => g.type === 'retail')).toBeDefined();
        expect(result.find(g => g.id === 'sup-1')).toBeDefined();
    });
    
    it('sorts products within groups', () => {
        const products: Product[] = [
            { id: '1', name: 'Zebra', price: 100, stock: 10, supplierId: 'sup-1' },
            { id: '2', name: 'Apple', price: 100, stock: 10, supplierId: 'sup-1' }
        ];
        const result = createProductGroups(products);
        const supplierGroup = result.find(g => g.id === 'sup-1');
        expect(supplierGroup?.products[0].name).toBe('Apple');
        expect(supplierGroup?.products[1].name).toBe('Zebra');
    });
});

describe('filterAndGroupProducts', () => {
    it('filters and groups products', () => {
        const products: Product[] = [
            { id: '1', name: 'Apple', price: 100, stock: 10, category: 'Fruit', supplierId: 'sup-1', supplier: { id: 'sup-1', name: 'Supplier A' } as any },
            { id: '2', name: 'Banana', price: 100, stock: 0, category: 'Fruit', supplierId: 'sup-1', supplier: { id: 'sup-1', name: 'Supplier A' } as any }
        ];
        const filterConfig: FilterConfig = { searchTerm: '', category: 'all', status: 'all' };
        const sortConfig: SortConfig = { column: 'name', direction: 'asc' };
        const result = filterAndGroupProducts(products, filterConfig, sortConfig);
        expect(result.length).toBe(1);
        expect(result[0].products.length).toBe(2);
    });
});

describe('toggleProductSelection', () => {
    it('toggles product selection', () => {
        const current = {};
        const result = toggleProductSelection(current, 'prod-1');
        expect(result['prod-1']).toBe(true);
        
        const result2 = toggleProductSelection(result, 'prod-1');
        expect(result2['prod-1']).toBe(false);
    });
});

describe('toggleGroupSelection', () => {
    it('selects all when none selected', () => {
        const current = {};
        const group: ProductGroup = {
            id: 'g1',
            name: 'Group 1',
            type: 'supplier',
            products: [
                { id: '1', name: 'A', price: 100, stock: 10 },
                { id: '2', name: 'B', price: 100, stock: 10 }
            ]
        };
        const result = toggleGroupSelection(current, group);
        expect(result['1']).toBe(true);
        expect(result['2']).toBe(true);
    });
    
    it('deselects all when all selected', () => {
        const current = { '1': true, '2': true };
        const group: ProductGroup = {
            id: 'g1',
            name: 'Group 1',
            type: 'supplier',
            products: [
                { id: '1', name: 'A', price: 100, stock: 10 },
                { id: '2', name: 'B', price: 100, stock: 10 }
            ]
        };
        const result = toggleGroupSelection(current, group);
        expect(result['1']).toBe(false);
        expect(result['2']).toBe(false);
    });
});

describe('selectAllInGroup', () => {
    it('selects all products', () => {
        const current = {};
        const group: ProductGroup = {
            id: 'g1',
            name: 'Group 1',
            type: 'supplier',
            products: [
                { id: '1', name: 'A', price: 100, stock: 10 },
                { id: '2', name: 'B', price: 100, stock: 10 }
            ]
        };
        const result = selectAllInGroup(current, group, true);
        expect(result['1']).toBe(true);
        expect(result['2']).toBe(true);
    });
    
    it('deselects all products', () => {
        const current = { '1': true, '2': true };
        const group: ProductGroup = {
            id: 'g1',
            name: 'Group 1',
            type: 'supplier',
            products: [
                { id: '1', name: 'A', price: 100, stock: 10 },
                { id: '2', name: 'B', price: 100, stock: 10 }
            ]
        };
        const result = selectAllInGroup(current, group, false);
        expect(result['1']).toBe(false);
        expect(result['2']).toBe(false);
    });
});

describe('clearSelections', () => {
    it('clears all selections', () => {

        const result = clearSelections();
        expect(result).toEqual({});
    });
});

describe('getSelectedProducts', () => {
    it('returns selected products', () => {
        const groups: ProductGroup[] = [
            {
                id: 'g1',
                name: 'Group 1',
                type: 'supplier',
                products: [
                    { id: '1', name: 'A', price: 100, stock: 10 },
                    { id: '2', name: 'B', price: 100, stock: 10 }
                ]
            }
        ];
        const selections = { '1': true, '2': false };
        const result = getSelectedProducts(groups, selections);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('A');
    });
});

describe('toggleExpansion', () => {
    it('toggles expansion', () => {
        const current = { 'g1': true };
        const result = toggleExpansion(current, 'g1');
        expect(result['g1']).toBe(false);
        
        const result2 = toggleExpansion(result, 'g1');
        expect(result2['g1']).toBe(true);
    });
    
    it('adds new group', () => {
        const current = { 'g1': true };
        const result = toggleExpansion(current, 'g2');
        expect(result['g2']).toBe(true);
    });
});

describe('setExpansion', () => {
    it('sets expansion state', () => {
        const current = { 'g1': true };
        const result = setExpansion(current, 'g1', false);
        expect(result['g1']).toBe(false);
    });
});

describe('expandAllGroups', () => {
    it('expands all groups', () => {
        const groups: ProductGroup[] = [
            { id: 'g1', name: 'Group 1', type: 'supplier', products: [] },
            { id: 'g2', name: 'Group 2', type: 'retail', products: [] }
        ];
        const result = expandAllGroups(groups);
        expect(result['g1']).toBe(true);
        expect(result['g2']).toBe(true);
    });
});

describe('collapseAllGroups', () => {
    it('collapses all groups', () => {
        const result = collapseAllGroups();
        expect(result).toEqual({});
    });
});

describe('validateSearchTerm', () => {
    it('validates short search term', () => {
        const result = validateSearchTerm('test');
        expect(result.valid).toBe(true);
    });
    
    it('validates empty search term', () => {
        const result = validateSearchTerm('');
        expect(result.valid).toBe(true);
    });
    
    it('invalidates long search term', () => {
        const long = 'a'.repeat(101);
        const result = validateSearchTerm(long);
        expect(result.valid).toBe(false);
    });
});

describe('validateCategoryFilter', () => {
    it('validates all category', () => {
        const result = validateCategoryFilter(['Fruit', 'Vegetable'], 'all');
        expect(result).toBe(true);
    });
    
    it('validates existing category', () => {
        const result = validateCategoryFilter(['Fruit', 'Vegetable'], 'Fruit');
        expect(result).toBe(true);
    });
    
    it('invalidates non-existing category', () => {
        const result = validateCategoryFilter(['Fruit', 'Vegetable'], 'Meat');
        expect(result).toBe(false);
    });
});

describe('getCategories', () => {
    it('extracts unique categories', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, category: 'Fruit' },
            { id: '2', name: 'B', price: 100, stock: 10, category: 'Fruit' },
            { id: '3', name: 'C', price: 100, stock: 10, category: 'Vegetable' }
        ];
        const result = getCategories(products);
        expect(result.length).toBe(2);
        expect(result).toContain('Fruit');
        expect(result).toContain('Vegetable');
    });
    
    it('filters null categories', () => {
        const products: Product[] = [
            { id: '1', name: 'A', price: 100, stock: 10, category: 'Fruit' },
            { id: '2', name: 'B', price: 100, stock: 10, category: null as any }
        ];
        const result = getCategories(products);
        expect(result.length).toBe(1);
        expect(result[0]).toBe('Fruit');
    });
});

describe('getGroupCountSummary', () => {
    it('returns summary', () => {
        const groups: ProductGroup[] = [
            { id: 'g1', name: 'Group 1', type: 'supplier', products: [{ id: '1', name: 'A', price: 100, stock: 10 }] },
            { id: 'g2', name: 'Group 2', type: 'retail', products: [{ id: '2', name: 'B', price: 100, stock: 10 }] }
        ];
        const result = getGroupCountSummary(groups);
        expect(result).toContain('2 grup');
        expect(result).toContain('2 produk');
        expect(result).toContain('1 supplier');
    });
});

describe('getSelectedCountSummary', () => {
    it('returns count summary', () => {
        const result = getSelectedCountSummary({ '1': true, '2': true, '3': false });
        expect(result).toContain('2 dipilih');
    });
    
    it('returns none selected', () => {
        const result = getSelectedCountSummary({});
        expect(result).toContain('Tidak ada yang dipilih');
    });
});

describe('formatProductDisplay', () => {
    it('formats product for display', () => {
        const product: Product = {
            id: '1',
            name: 'Apple',
            price: 10000,
            stock: 10,
            category: 'Fruit',
            supplier: { id: 's1', name: 'Supplier A' } as any
        };
        const result = formatProductDisplay(product);
        expect(result['Nama']).toBe('Apple');
        expect(result['Kategori']).toBe('Fruit');
        expect(result['Stok']).toBe('10');
    });
    
    it('handles null supplier', () => {
        const product: Product = { id: '1', name: 'Apple', price: 10000, stock: 10 };
        const result = formatProductDisplay(product);
        expect(result['Supplier']).toBe('-');
    });
});

describe('getLowStockSummary', () => {
    it('returns summary', () => {
        const products: Product[] = [
            { id: '1', name: 'A', stock: 0, threshold: 10, price: 10000 },
            { id: '2', name: 'B', stock: 5, threshold: 10, price: 10000 },
            { id: '3', name: 'C', stock: 20, threshold: 10, price: 10000 },
            { id: '4', name: 'D', stock: 10, threshold: 10, price: 10000 }
        ];
        const result = getLowStockSummary(products);
        expect(result.total).toBe(4);
        expect(result.outOfStock).toBe(1);
        expect(result.lowStock).toBe(2); // B and D are at threshold
    });
});

describe('formatLowStockSummary', () => {
    it('formats summary', () => {
        const summary = { total: 10, outOfStock: 2, lowStock: 3 };
        const result = formatLowStockSummary(summary);
        expect(result).toContain('Total: 10');
        expect(result).toContain('Habis: 2');
        expect(result).toContain('Rendah: 3');
    });
});

describe('updateSearchTerm', () => {
    it('updates search term', () => {
        const state = createInitialTableState();
        const result = updateSearchTerm(state, 'apple');
        expect(result.searchTerm).toBe('apple');
    });
});

describe('updateCategoryFilter', () => {
    it('updates category filter', () => {
        const state = createInitialTableState();
        const result = updateCategoryFilter(state, 'Fruit');
        expect(result.categoryFilter).toBe('Fruit');
    });
});

describe('updateStatusFilter', () => {
    it('updates status filter', () => {
        const state = createInitialTableState();
        const result = updateStatusFilter(state, 'out_of_stock');
        expect(result.statusFilter).toBe('out_of_stock');
    });
});

describe('toggleFilters', () => {
    it('toggles filters visibility', () => {
        const state = createInitialTableState();
        const result = toggleFilters(state);
        expect(result.showFilters).toBe(true);
        
        const result2 = toggleFilters(result);
        expect(result2.showFilters).toBe(false);
    });
});

describe('resetFilters', () => {
    it('resets all filters', () => {
        const state: TableState = {
            ...createInitialTableState(),
            searchTerm: 'test',
            categoryFilter: 'Fruit',
            statusFilter: 'out_of_stock'
        };
        const result = resetFilters(state);
        expect(result.searchTerm).toBe('');
        expect(result.categoryFilter).toBe('all');
        expect(result.statusFilter).toBe('all');
    });
});

describe('prepareProductsExport', () => {
    it('prepares products for export', () => {
        const products: Product[] = [
            { id: '1', name: 'Apple', price: 10000, stock: 10, category: 'Fruit' }
        ];
        const result = prepareProductsExport(products);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('Apple');
    });
});

describe('prepareGroupsExport', () => {
    it('prepares groups for export', () => {
        const groups: ProductGroup[] = [
            {
                id: 'g1',
                name: 'Supplier A',
                type: 'supplier',
                products: [{ id: '1', name: 'Apple', price: 10000, stock: 10, category: 'Fruit' }]
            }
        ];
        const result = prepareGroupsExport(groups);
        expect(result.length).toBe(1);
        expect(result[0]['Grup']).toBe('Supplier A');
        expect(result[0]['Nama']).toBe('Apple');
    });
});
