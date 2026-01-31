// ============================================================================
// TYPES
// ============================================================================

export interface Product {
  id: string;
  name: string;
  product_code?: string | null;
  barcode?: string | null;
  description?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit?: string;
  threshold?: number | null;
  purchase_price?: number | null;
  min_selling_price?: number | null;
  supplierId?: string | null;
  supplier?: Supplier | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface FilterState {
  search: string;
  activeSearch: string;
  category: string;
  page: number;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface DeleteDialogState {
  open: boolean;
  productId: string | null;
  isDeleting: boolean;
}

export interface ConversionDialogState {
  open: boolean;
  product: Product | null;
  quantity: string;
  isConverting: boolean;
}

export interface SortState {
  field: keyof Product | 'stockValue';
  direction: 'asc' | 'desc';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial filter state
 * Pure function - no side effects
 */
export function createInitialFilterState(): FilterState {
  return {
    search: '',
    activeSearch: '',
    category: 'all',
    page: 1
  };
}

/**
 * Create initial pagination state
 * Pure function - no side effects
 */
export function createInitialPaginationState(): PaginationState {
  return {
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalItems: 0
  };
}

/**
 * Create initial delete dialog state
 * Pure function - no side effects
 */
export function createInitialDeleteState(): DeleteDialogState {
  return {
    open: false,
    productId: null,
    isDeleting: false
  };
}

/**
 * Create initial conversion dialog state
 * Pure function - no side effects
 */
export function createInitialConversionState(): ConversionDialogState {
  return {
    open: false,
    product: null,
    quantity: '1',
    isConverting: false
  };
}

/**
 * Create initial sort state
 * Pure function - no side effects
 */
export function createInitialSortState(): SortState {
  return {
    field: 'createdAt',
    direction: 'desc'
  };
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Calculate pagination metadata
 * Pure function - no side effects
 */
export function calculatePagination(totalItems: number, pageSize: number): PaginationState {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    currentPage: 1,
    pageSize,
    totalPages,
    totalItems
  };
}

/**
 * Check if page is valid
 * Pure function - no side effects
 */
export function isValidPage(page: number, totalPages: number): boolean {
  return page >= 1 && page <= totalPages;
}

/**
 * Get pagination range for display
 * Pure function - no side effects
 */
export function getPaginationRange(currentPage: number, totalPages: number, maxVisible: number = 5): number[] {
  const pages: number[] = [];
  
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
}

/**
 * Reset page to 1
 * Pure function - no side effects
 */
export function resetPage(currentState: FilterState): FilterState {
  return {
    ...currentState,
    page: 1
  };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Check if product matches search query
 * Pure function - no side effects
 */
export function matchesSearch(product: Product, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  
  const query = searchQuery.toLowerCase().trim();
  
  return (
    (product.name?.toLowerCase() || '').includes(query) ||
    (product.product_code?.toLowerCase() || '').includes(query) ||
    product.barcode?.includes(query) ||
    (product.category?.toLowerCase() || '').includes(query)
  );
}

/**
 * Check if product matches category filter
 * Pure function - no side effects
 */
export function matchesCategory(product: Product, categoryFilter: string): boolean {
  if (categoryFilter === 'all') return true;
  return product.category === categoryFilter;
}

/**
 * Apply all filters to products
 * Pure function - no side effects
 */
export function applyFilters(products: Product[], filterState: FilterState): Product[] {
  return products.filter(product =>
    matchesSearch(product, filterState.activeSearch) &&
    matchesCategory(product, filterState.category)
  );
}

/**
 * Get unique categories from products
 * Pure function - no side effects
 */
export function getUniqueCategories(products: Product[]): string[] {
  const categories = new Set<string>();
  products.forEach(product => {
    if (product.category) {
      categories.add(product.category);
    }
  });
  return Array.from(categories).sort();
}

/**
 * Filter products for page
 * Pure function - no side effects
 */
export function getPageProducts(products: Product[], pagination: PaginationState): Product[] {
  const start = (pagination.currentPage - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  return products.slice(start, end);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Get sort value from product
 * Pure function - no side effects
 */
function getSortValue(product: Product, field: keyof Product | 'stockValue'): string | number | Date {
  switch (field) {
    case 'stockValue':
      return product.stock * product.price;
    case 'createdAt':
    case 'updatedAt':
      return new Date(product[field] as string);
    case 'name':
    case 'category':
    case 'product_code':
      return (product[field] as string) || '';
    case 'price':
    case 'stock':
      return product[field] as number;
    default:
      return product[field] as string;
  }
}

/**
 * Sort products by field and direction
 * Pure function - no side effects
 */
export function sortProducts(products: Product[], sortState: SortState): Product[] {
  const { field, direction } = sortState;
  
  return [...products].sort((a, b) => {
    const aValue = getSortValue(a, field);
    const bValue = getSortValue(b, field);
    
    let comparison = 0;
    
    if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Toggle sort direction
 * Pure function - no side effects
 */
export function toggleSort(currentSort: SortState, field: keyof Product | 'stockValue'): SortState {
  if (currentSort.field === field) {
    return {
      field,
      direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
    };
  }
  
  return {
    field,
    direction: 'desc'
  };
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate stock value
 * Pure function - no side effects
 */
export function calculateStockValue(price: number, stock: number): number {
  return price * stock;
}

/**
 * Calculate stock status
 * Pure function - no side effects
 */
export function getStockStatus(params: {
  stock: number;
  threshold: number | null | undefined;
}): 'critical' | 'warning' | 'normal' {
  const { stock, threshold } = params;
  
  if (stock === 0) return 'critical';
  if (threshold && stock <= threshold) return 'warning';
  return 'normal';
}

/**
 * Calculate pagination info
 * Pure function - no side effects
 */
export function getPaginationInfo(params: {
  totalItems: number;
  currentPage: number;
  pageSize: number;
}): { startItem: number; endItem: number; totalPages: number } {
  const { totalItems, currentPage, pageSize } = params;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  
  return { startItem, endItem, totalPages };
}

// ============================================================================
// SEARCH DEBOUNCE
// ============================================================================

/**
 * Check if search should trigger (debounce logic)
 * Pure function - no side effects
 */
export function shouldTriggerSearch(currentSearch: string, activeSearch: string): boolean {
  return currentSearch !== activeSearch;
}

/**
 * Get search debounce delay
 * Pure function - no side effects
 */
export function getSearchDebounceDelay(): number {
  return 500; // milliseconds
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Format price for display
 * Pure function - no side effects
 */
export function formatPriceForDisplay(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatDateForDisplay(dateString: string | undefined): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format stock for display
 * Pure function - no side effects
 */
export function formatStockForDisplay(stock: number, unit: string | undefined): string {
  const unitStr = unit || 'pcs';
  return `${stock.toLocaleString('id-ID')} ${unitStr}`;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate delete confirmation
 * Pure function - no side effects
 */
export function validateDelete(productName: string, confirmation: string): boolean {
  return confirmation.trim().toLowerCase() === productName.toLowerCase();
}

/**
 * Validate conversion quantity
 * Pure function - no side effects
 */
export function validateConversionQuantity(params: {
  quantity: string;
  currentStock: number;
}): { valid: boolean; error?: string } {
  const { quantity, currentStock } = params;
  
  const numQuantity = parseInt(quantity, 10);
  
  if (isNaN(numQuantity) || numQuantity <= 0) {
    return { valid: false, error: 'Jumlah harus lebih dari 0' };
  }
  
  if (numQuantity > currentStock) {
    return { valid: false, error: 'Jumlah tidak boleh melebihi stok' };
  }
  
  return { valid: true };
}

/**
 * Validate search query
 * Pure function - no side effects
 */
export function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= 0; // Allow empty, just won't filter
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Check if all products are selected
 * Pure function - no side effects
 */
export function isAllSelected(productIds: string[], selectedIds: Set<string>): boolean {
  if (productIds.length === 0) return false;
  return productIds.every(id => selectedIds.has(id));
}

/**
 * Check if any products are selected
 * Pure function - no side effects
 */
export function hasSelection(selectedIds: Set<string>): boolean {
  return selectedIds.size > 0;
}

/**
 * Get selected count
 * Pure function - no side effects
 */
export function getSelectedCount(selectedIds: Set<string>): number {
  return selectedIds.size;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Prepare product data for export
 * Pure function - no side effects
 */
export function prepareForExport(products: Product[]): Array<Record<string, string>> {
  return products.map(product => ({
    'Nama': product.name,
    'Kode': product.product_code || '-',
    'Barcode': product.barcode || '-',
    'Kategori': product.category || '-',
    'Harga': formatPriceForDisplay(product.price),
    'Stok': product.stock.toString(),
    'Satuan': product.unit || 'pcs',
    'Threshold': product.threshold?.toString() || '-',
    'Status Stok': getStockStatus({ stock: product.stock, threshold: product.threshold })
  }));
}

/**
 * Get summary statistics
 * Pure function - no side effects
 */
export function getSummaryStats(products: Product[]): {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryCount: number;
} {
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + calculateStockValue(p.price, p.stock), 0);
  
  let lowStockCount = 0;
  let outOfStockCount = 0;
  
  products.forEach(product => {
    const status = getStockStatus({ stock: product.stock, threshold: product.threshold });
    if (status === 'critical') outOfStockCount++;
    if (status === 'warning') lowStockCount++;
  });
  
  const categoryCount = getUniqueCategories(products).length;
  
  return {
    totalProducts,
    totalValue,
    lowStockCount,
    outOfStockCount,
    categoryCount
  };
}
