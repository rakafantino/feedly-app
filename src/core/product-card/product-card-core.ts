// ============================================================================
// TYPES
// ============================================================================

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
    supplier?: { id: string; name: string } | null;
    convertedFrom?: string[] | null;
    conversionTargetId?: string | null;
    conversion_rate?: number | null;
    isDeleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProductCardConfig {
    showConvert: boolean;
    showSync: boolean;
}

export interface StockStatus {
    variant: 'default' | 'destructive' | 'secondary' | 'outline';
    label: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_NO_DESCRIPTION = 'Tidak ada deskripsi';
export const DEFAULT_NO_CATEGORY = 'Tidak ada kategori';
export const CONVERT_BUTTON_TEXT = 'Buka';
export const EDIT_BUTTON_TEXT = 'Edit';
export const DELETE_BUTTON_TEXT = 'Hapus';
export const STOCK_PREFIX = 'Stok: ';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create default card config
 * Pure function - no side effects
 */
export function createDefaultCardConfig(): ProductCardConfig {
    return {
        showConvert: true,
        showSync: true
    };
}

/**
 * Create empty product (fallback)
 * Pure function - no side effects
 */
export function createEmptyProduct(): Product {
    return {
        id: '',
        name: '',
        description: null,
        category: null,
        price: 0,
        stock: 0
    };
}

// ============================================================================
// STOCK STATUS
// ============================================================================

/**
 * Determine stock status
 * Pure function - no side effects
 */
export function getStockStatus(stock: number, threshold?: number | null): StockStatus {
    const effectiveThreshold = threshold || 0;
    
    if (stock <= 0) {
        return { variant: 'destructive', label: 'Habis' };
    }
    
    if (stock <= effectiveThreshold) {
        return { variant: 'secondary', label: 'Habis' };
    }
    
    return { variant: 'outline', label: 'Tersedia' };
}

/**
 * Get stock variant for badge
 * Pure function - no side effects
 */
export function getStockVariant(stock: number, threshold?: number | null): 'default' | 'destructive' | 'secondary' | 'outline' {
    return getStockStatus(stock, threshold).variant;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format price for display
 * Pure function - no side effects
 */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

/**
 * Format stock for display
 * Pure function - no side effects
 */
export function formatStock(stock: number): string {
    return `${STOCK_PREFIX}${stock}`;
}

/**
 * Get description text
 * Pure function - no side effects
 */
export function getDescription(description: string | null | undefined): string {
    return description || DEFAULT_NO_DESCRIPTION;
}

/**
 * Get category text
 * Pure function - no side effects
 */
export function getCategory(category: string | null | undefined): string {
    return category || DEFAULT_NO_CATEGORY;
}

/**
 * Format card title
 * Pure function - no side effects
 */
export function formatCardTitle(name: string): string {
    return name;
}

/**
 * Format card subtitle
 * Pure function - no side effects
 */
export function formatCardSubtitle(description: string | null | undefined): string {
    return getDescription(description);
}

/**
 * Format category with icon
 * Pure function - no side effects
 */
export function formatCategoryWithIcon(category: string | null | undefined): string {
    return getCategory(category);
}

// ============================================================================
// BUTTON CONFIGURATION
// ============================================================================

/**
 * Check if convert button should show
 * Pure function - no side effects
 */
export function shouldShowConvert(product: Product, onConvert?: (product: Product) => void): boolean {
    return !!product.conversionTargetId && !!onConvert;
}

/**
 * Check if sync button should show
 * Pure function - no side effects
 */
export function shouldShowSync(product: Product, onSync?: (id: string, name: string) => void): boolean {
    return !!onSync;
}

/**
 * Check if edit button should show
 * Pure function - no side effects
 */
export function shouldShowEdit(product: Product): boolean {
    return !product.isDeleted;
}

/**
 * Check if delete button should show
 * Pure function - no side effects
 */
export function shouldShowDelete(product: Product): boolean {
    return !product.isDeleted;
}

/**
 * Get button visibility config
 * Pure function - no side effects
 */
export function getButtonVisibility(product: Product, hasConvert: boolean, hasSync: boolean): {
    showConvert: boolean;
    showSync: boolean;
    showEdit: boolean;
    showDelete: boolean;
} {
    return {
        showConvert: shouldShowConvert(product, hasConvert ? () => {} : undefined),
        showSync: shouldShowSync(product, hasSync ? () => {} : undefined),
        showEdit: shouldShowEdit(product),
        showDelete: shouldShowDelete(product)
    };
}

// ============================================================================
// CARD CONTENT
// ============================================================================

/**
 * Get card content for display
 * Pure function - no side effects
 */
export function getCardContent(product: Product): {
    title: string;
    subtitle: string;
    category: string;
    price: string;
    stockStatus: StockStatus;
    stockDisplay: string;
} {
    return {
        title: formatCardTitle(product.name),
        subtitle: formatCardSubtitle(product.description),
        category: formatCategoryWithIcon(product.category),
        price: formatPrice(product.price),
        stockStatus: getStockStatus(product.stock, product.threshold),
        stockDisplay: formatStock(product.stock)
    };
}

/**
 * Check if card has content
 * Pure function - no side effects
 */
export function hasCardContent(product: Product): boolean {
    return !!product.id && !!product.name;
}

/**
 * Check if card is empty
 * Pure function - no side effects
 */
export function isEmptyCard(product: Product): boolean {
    return !hasCardContent(product);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate product for card display
 * Pure function - no side effects
 */
export function validateForDisplay(product: Product): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!product.id) {
        errors.push('Product ID is required');
    }
    
    if (!product.name) {
        errors.push('Product name is required');
    }
    
    if (product.price === undefined || product.price === null) {
        errors.push('Product price is required');
    }
    
    if (product.stock === undefined || product.stock === null) {
        errors.push('Product stock is required');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if product can be displayed
 * Pure function - no side effects
 */
export function canDisplay(product: Product): boolean {
    return validateForDisplay(product).valid;
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if product changed
 * Pure function - no side effects
 */
export function hasProductChanged(original: Product, updated: Partial<Product>): boolean {
    return (
        original.name !== updated.name ||
        (original.description || '') !== (updated.description || '') ||
        original.price !== updated.price ||
        original.stock !== updated.stock ||
        (original.category || '') !== (updated.category || '')
    );
}

/**
 * Find product by ID
 * Pure function - no side effects
 */
export function findProductById(products: Product[], id: string): Product | undefined {
    return products.find(p => p.id === id);
}

/**
 * Check if product exists
 * Pure function - no side effects
 */
export function productExists(products: Product[], id: string): boolean {
    return products.some(p => p.id === id);
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter products by category
 * Pure function - no side effects
 */
export function filterByCategory(products: Product[], category: string): Product[] {
    return products.filter(p => p.category === category);
}

/**
 * Filter products by stock status
 * Pure function - no side effects
 */
export function filterByStockStatus(products: Product[], status: 'in_stock' | 'low_stock' | 'out_of_stock'): Product[] {
    switch (status) {
        case 'in_stock':
            return products.filter(p => p.stock > (p.threshold || 0));
        case 'low_stock':
            return products.filter(p => p.stock > 0 && p.stock <= (p.threshold || 0));
        case 'out_of_stock':
            return products.filter(p => p.stock <= 0);
        default:
            return products;
    }
}

/**
 * Filter active products
 * Pure function - no side effects
 */
export function filterActiveProducts(products: Product[]): Product[] {
    return products.filter(p => !p.isDeleted);
}

/**
 * Filter products with conversion
 * Pure function - no side effects
 */
export function filterProductsWithConversion(products: Product[]): Product[] {
    return products.filter(p => !!p.conversionTargetId);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort products by name
 * Pure function - no side effects
 */
export function sortByProductName(products: Product[], direction: 'asc' | 'desc' = 'asc'): Product[] {
    return [...products].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return direction === 'asc' ? comparison : -comparison;
    });
}

/**
 * Sort products by price
 * Pure function - no side effects
 */
export function sortByPrice(products: Product[], direction: 'asc' | 'desc' = 'asc'): Product[] {
    return [...products].sort((a, b) => {
        return direction === 'asc' 
            ? a.price - b.price 
            : b.price - a.price;
    });
}

/**
 * Sort products by stock
 * Pure function - no side effects
 */
export function sortByStock(products: Product[], direction: 'asc' | 'desc' = 'asc'): Product[] {
    return [...products].sort((a, b) => {
        return direction === 'asc' 
            ? a.stock - b.stock 
            : b.stock - a.stock;
    });
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Get products summary
 * Pure function - no side effects
 */
export function getProductsSummary(products: Product[]): {
    total: number;
    active: number;
    outOfStock: number;
    lowStock: number;
    withConversion: number;
    totalStockValue: number;
} {
    const active = products.filter(p => !p.isDeleted);
    const outOfStock = active.filter(p => p.stock <= 0);
    const lowStock = active.filter(p => p.stock > 0 && p.stock <= (p.threshold || 0));
    const withConversion = active.filter(p => !!p.conversionTargetId);
    const totalStockValue = active.reduce((sum, p) => sum + (p.price * p.stock), 0);
    
    return {
        total: products.length,
        active: active.length,
        outOfStock: outOfStock.length,
        lowStock: lowStock.length,
        withConversion: withConversion.length,
        totalStockValue
    };
}

/**
 * Format products summary
 * Pure function - no side effects
 */
export function formatProductsSummary(summary: { total: number; active: number; outOfStock: number; lowStock: number }): string {
    return `Total: ${summary.total} | Aktif: ${summary.active} | Habis: ${summary.outOfStock} | Rendah: ${summary.lowStock}`;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare products for card export
 * Pure function - no side effects
 */
export function prepareProductsForCardExport(products: Product[]): Array<Record<string, string>> {
    return products.map(p => ({
        'Nama': p.name,
        'Kategori': getCategory(p.category),
        'Harga': formatPrice(p.price),
        'Stok': String(p.stock),
        'Status': getStockStatus(p.stock, p.threshold).label
    }));
}

/**
 * Get card class names
 * Pure function - no side effects
 */
export function getCardClassNames(compact?: boolean): string {
    const classes = ['h-full'];
    if (compact) {
        classes.push('compact');
    }
    return classes.join(' ');
}
