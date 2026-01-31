// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
}

export interface Product {
    id: string;
    name: string;
    product_code?: string | null;
    description?: string | null;
    category?: string | null;
    barcode?: string | null;
    price: number;
    stock: number;
    unit?: string | null;
    threshold?: number | null;
    purchase_price?: number | null;
    min_selling_price?: number | null;
    supplierId?: string | null;
    supplier?: Supplier | null;
    convertedFrom?: string[] | null;
    conversionTargetId?: string | null;
    conversion_rate?: number | null;
    isDeleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProductGroup {
    id: string;
    name: string;
    type: "supplier" | "retail" | "other";
    products: Product[];
}

export interface SortConfig {
    column: string;
    direction: "asc" | "desc";
}

export interface FilterConfig {
    searchTerm: string;
    category: string;
    status: string;
}

export interface TableState {
    sortColumn: string;
    sortDirection: "asc" | "desc";
    searchTerm: string;
    showFilters: boolean;
    categoryFilter: string;
    statusFilter: string;
    expandedGroups: Record<string, boolean>;
    selectedProducts: Record<string, boolean>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_SORT_COLUMN = "name";
export const DEFAULT_SORT_DIRECTION = "asc";

export const STATUS_FILTERS = {
    ALL: "all",
    OUT_OF_STOCK: "out_of_stock",
    LOW_STOCK: "low_stock"
};

export const STATUS_LABELS: Record<string, string> = {
    all: "Semua",
    out_of_stock: "Stok Habis",
    low_stock: "Stok Rendah"
};

export const DEFAULT_CATEGORY = "all";

export const GROUP_TYPES = {
    SUPPLIER: "supplier" as const,
    RETAIL: "retail" as const,
    OTHER: "other" as const
};

export const GROUP_LABELS = {
    retail: "Produk Eceran (Buka Kemasan)",
    noSupplier: "Produk Tanpa Supplier",
    unknown: "Unknown Supplier"
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial sort config
 * Pure function - no side effects
 */
export function createInitialSortConfig(): SortConfig {
    return {
        column: DEFAULT_SORT_COLUMN,
        direction: DEFAULT_SORT_DIRECTION
    };
}

/**
 * Create initial filter config
 * Pure function - no side effects
 */
export function createInitialFilterConfig(): FilterConfig {
    return {
        searchTerm: "",
        category: DEFAULT_CATEGORY,
        status: STATUS_FILTERS.ALL
    };
}

/**
 * Create initial table state
 * Pure function - no side effects
 */
export function createInitialTableState(): TableState {
    return {
        sortColumn: DEFAULT_SORT_COLUMN,
        sortDirection: DEFAULT_SORT_DIRECTION,
        searchTerm: "",
        showFilters: false,
        categoryFilter: DEFAULT_CATEGORY,
        statusFilter: STATUS_FILTERS.ALL,
        expandedGroups: {},
        selectedProducts: {}
    };
}

/**
 * Create expanded groups for groups
 * Pure function - no side effects
 */
export function createExpandedGroups(groups: ProductGroup[]): Record<string, boolean> {
    const expanded: Record<string, boolean> = {};
    groups.forEach(g => expanded[g.id] = true);
    return expanded;
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort products by column
 * Pure function - no side effects
 */
export function sortProducts(products: Product[], column: string, direction: "asc" | "desc"): Product[] {
    const sorted = [...products].sort((a, b) => {
        const dir = direction === "asc" ? 1 : -1;
        switch (column) {
            case "name":
                return a.name.localeCompare(b.name) * dir;
            case "category":
                return (a.category || "").localeCompare(b.category || "") * dir;
            case "stock":
                return ((a.stock || 0) - (b.stock || 0)) * dir;
            case "price":
                return ((a.price || 0) - (b.price || 0)) * dir;
            default:
                return 0;
        }
    });
    return sorted;
}

/**
 * Toggle sort direction for column
 * Pure function - no side effects
 */
export function toggleSort(current: SortConfig, column: string): SortConfig {
    if (current.column === column) {
        return {
            column,
            direction: current.direction === "asc" ? "desc" : "asc"
        };
    }
    return {
        column,
        direction: "asc"
    };
}

/**
 * Set sort column and direction
 * Pure function - no side effects
 */
export function setSort(current: SortConfig, column: string, direction: "asc" | "desc"): SortConfig {
    return { column, direction };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter products by search term
 * Pure function - no side effects
 */
export function filterBySearchTerm(products: Product[], searchTerm: string): Product[] {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(term));
}

/**
 * Filter products by category
 * Pure function - no side effects
 */
export function filterByCategory(products: Product[], category: string): Product[] {
    if (category === DEFAULT_CATEGORY) return products;
    return products.filter(p => p.category === category);
}

/**
 * Filter products by status
 * Pure function - no side effects
 */
export function filterByStatus(products: Product[], status: string): Product[] {
    if (status === STATUS_FILTERS.ALL) return products;
    return products.filter(p => {
        if (status === STATUS_FILTERS.OUT_OF_STOCK) return p.stock <= 0;
        if (status === STATUS_FILTERS.LOW_STOCK) return p.stock > 0;
        return true;
    });
}

/**
 * Filter products with all criteria
 * Pure function - no side effects
 */
export function filterProducts(products: Product[], config: FilterConfig): Product[] {
    let filtered = filterBySearchTerm(products, config.searchTerm);
    filtered = filterByCategory(filtered, config.category);
    filtered = filterByStatus(filtered, config.status);
    return filtered;
}

// ============================================================================
// GROUPING
// ============================================================================

/**
 * Categorize product
 * Pure function - no side effects
 */
export function categorizeProductType(product: Product): "retail" | "supplier" | "other" {
    if (product.convertedFrom && product.convertedFrom.length > 0) {
        return "retail";
    }
    if (product.supplierId) {
        return "supplier";
    }
    return "other";
}

/**
 * Group products by supplier
 * Pure function - no side effects
 */
export function groupBySupplier(products: Product[]): Record<string, Product[]> {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
        const supplierId = p.supplierId || "no-supplier";
        if (!groups[supplierId]) groups[supplierId] = [];
        groups[supplierId].push(p);
    });
    return groups;
}

/**
 * Get retail products
 * Pure function - no side effects
 */
export function getRetailProducts(products: Product[]): Product[] {
    return products.filter(p => p.convertedFrom && p.convertedFrom.length > 0);
}

/**
 * Get products for supplier groups (not retail, has supplierId)
 * Pure function - no side effects
 */
export function getSupplierProducts(products: Product[]): Product[] {
    return products.filter(p => p.supplierId && !(p.convertedFrom && p.convertedFrom.length > 0));
}

/**
 * Create product groups
 * Pure function - no side effects
 */
export function createProductGroups(products: Product[]): ProductGroup[] {
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    const groups: ProductGroup[] = [];
    
    const retail = getRetailProducts(sorted);
    if (retail.length > 0) {
        groups.push({
            id: "retail-group",
            name: GROUP_LABELS.retail,
            type: "retail",
            products: retail
        });
    }
    
    const supplierProducts = getSupplierProducts(sorted);
    const supplierGroups = groupBySupplier(supplierProducts);
    Object.keys(supplierGroups).forEach(supplierId => {
        const groupProducts = supplierGroups[supplierId];
        const supplierName = groupProducts[0]?.supplier?.name || GROUP_LABELS.unknown;
        groups.push({
            id: supplierId,
            name: supplierName,
            type: supplierId === "no-supplier" ? "other" : "supplier",
            products: groupProducts
        });
    });
    
    return groups;
}

/**
 * Filter and group products
 * Pure function - no side effects
 */
export function filterAndGroupProducts(products: Product[], filterConfig: FilterConfig, sortConfig: SortConfig): ProductGroup[] {
    const filtered = filterProducts(products, filterConfig);
    const sorted = sortProducts(filtered, sortConfig.column, sortConfig.direction);
    return createProductGroups(sorted);
}

// ============================================================================
// SELECTION
// ============================================================================

/**
 * Toggle product selection
 * Pure function - no side effects
 */
export function toggleProductSelection(current: Record<string, boolean>, productId: string): Record<string, boolean> {
    return {
        ...current,
        [productId]: !current[productId]
    };
}

/**
 * Toggle group selection
 * Pure function - no side effects
 */
export function toggleGroupSelection(current: Record<string, boolean>, group: ProductGroup): Record<string, boolean> {
    const allSelected = group.products.every(p => current[p.id]);
    const newSelection = { ...current };
    group.products.forEach(p => {
        newSelection[p.id] = !allSelected;
    });
    return newSelection;
}

/**
 * Select all in group
 * Pure function - no side effects
 */
export function selectAllInGroup(current: Record<string, boolean>, group: ProductGroup, select: boolean): Record<string, boolean> {
    const newSelection = { ...current };
    group.products.forEach(p => {
        newSelection[p.id] = select;
    });
    return newSelection;
}

/**
 * Clear all selections
 * Pure function - no side effects
 */
export function clearSelections(): Record<string, boolean> {
    return {};
}

/**
 * Get selected products from groups
 * Pure function - no side effects
 */
export function getSelectedProducts(groups: ProductGroup[], selections: Record<string, boolean>): Product[] {
    const selectedIds = Object.entries(selections)
        .filter(([, selected]) => selected)
        .map(([id]) => id);
    
    const allProducts = groups.flatMap(g => g.products);
    return allProducts.filter(p => selectedIds.includes(p.id));
}

// ============================================================================
// EXPANSION
// ============================================================================

/**
 * Toggle group expansion
 * Pure function - no side effects
 */
export function toggleExpansion(current: Record<string, boolean>, groupId: string): Record<string, boolean> {
    return {
        ...current,
        [groupId]: !current[groupId]
    };
}

/**
 * Set group expansion
 * Pure function - no side effects
 */
export function setExpansion(current: Record<string, boolean>, groupId: string, expanded: boolean): Record<string, boolean> {
    return {
        ...current,
        [groupId]: expanded
    };
}

/**
 * Expand all groups
 * Pure function - no side effects
 */
export function expandAllGroups(groups: ProductGroup[]): Record<string, boolean> {
    const expanded: Record<string, boolean> = {};
    groups.forEach(g => expanded[g.id] = true);
    return expanded;
}

/**
 * Collapse all groups
 * Pure function - no side effects
 */
export function collapseAllGroups(): Record<string, boolean> {
    return {};
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate search term
 * Pure function - no side effects
 */
export function validateSearchTerm(term: string): { valid: boolean; error?: string } {
    if (term.length > 100) {
        return { valid: false, error: "Pencarian maksimal 100 karakter" };
    }
    return { valid: true };
}

/**
 * Validate category filter
 * Pure function - no side effects
 */
export function validateCategoryFilter(categories: string[], category: string): boolean {
    return category === DEFAULT_CATEGORY || categories.includes(category);
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Get categories from products
 * Pure function - no side effects
 */
export function getCategories(products: Product[]): string[] {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
}

/**
 * Get group count summary
 * Pure function - no side effects
 */
export function getGroupCountSummary(groups: ProductGroup[]): string {
    const total = groups.reduce((sum, g) => sum + g.products.length, 0);
    const suppliers = groups.filter(g => g.type === "supplier").length;
    return `${groups.length} grup | ${total} produk | ${suppliers} supplier`;
}

/**
 * Get selected count summary
 * Pure function - no side effects
 */
export function getSelectedCountSummary(selections: Record<string, boolean>): string {
    const count = Object.values(selections).filter(v => v).length;
    return count === 0 ? "Tidak ada yang dipilih" : `${count} dipilih`;
}

// ============================================================================
// IMPORTS
// ============================================================================

import { formatRupiah } from "@/lib/utils";

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format currency for local use
 * Pure function - no side effects
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

/**
 * Format product for display
 * Pure function - no side effects
 */
export function formatProductDisplay(product: Product): Record<string, string> {
    return {
        'Nama': product.name,
        'Kategori': product.category || '-',
        'Stok': String(product.stock),
        'Harga': formatRupiah(product.price),
        'Supplier': product.supplier?.name || '-'
    };
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Get low stock summary
 * Pure function - no side effects
 */
export function getLowStockSummary(products: Product[]): {
    total: number;
    outOfStock: number;
    lowStock: number;
    byCategory: Record<string, number>;
} {
    const outOfStock = products.filter(p => p.stock <= 0);
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.threshold || 0));
    const byCategory: Record<string, number> = {};
    
    products.forEach(p => {
        const cat = p.category || 'Lainnya';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    
    return {
        total: products.length,
        outOfStock: outOfStock.length,
        lowStock: lowStock.length,
        byCategory
    };
}

/**
 * Format low stock summary
 * Pure function - no side effects
 */
export function formatLowStockSummary(summary: { total: number; outOfStock: number; lowStock: number }): string {
    return `Total: ${summary.total} | Habis: ${summary.outOfStock} | Rendah: ${summary.lowStock}`;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Update search term
 * Pure function - no side effects
 */
export function updateSearchTerm(current: TableState, term: string): TableState {
    return { ...current, searchTerm: term };
}

/**
 * Update category filter
 * Pure function - no side effects
 */
export function updateCategoryFilter(current: TableState, category: string): TableState {
    return { ...current, categoryFilter: category };
}

/**
 * Update status filter
 * Pure function - no side effects
 */
export function updateStatusFilter(current: TableState, status: string): TableState {
    return { ...current, statusFilter: status };
}

/**
 * Toggle filters visibility
 * Pure function - no side effects
 */
export function toggleFilters(current: TableState): TableState {
    return { ...current, showFilters: !current.showFilters };
}

/**
 * Reset filters
 * Pure function - no side effects
 */
export function resetFilters(current: TableState): TableState {
    return {
        ...current,
        searchTerm: "",
        categoryFilter: DEFAULT_CATEGORY,
        statusFilter: STATUS_FILTERS.ALL
    };
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare products for export
 * Pure function - no side effects
 */
export function prepareProductsExport(products: Product[]): Array<Record<string, string>> {
    return products.map(formatProductDisplay);
}

/**
 * Prepare groups for export
 * Pure function - no side effects
 */
export function prepareGroupsExport(groups: ProductGroup[]): Array<Record<string, string>> {
    return groups.flatMap(g => 
        g.products.map(p => ({
            'Grup': g.name,
            'Tipe': g.type,
            ...formatProductDisplay(p)
        }))
    );
}
