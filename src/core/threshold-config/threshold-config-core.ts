// ============================================================================
// TYPES
// ============================================================================

export interface Product {
  id: string;
  name: string;
  category?: string | null;
  threshold: number | null;
  [key: string]: unknown;
}

export interface ThresholdState {
  productThresholds: Record<string, string>;
  categoryThresholds: Record<string, string>;
}

export interface FilterState {
  search: string;
  category: string;
}

export interface MassUpdateState {
  value: string;
  selectedIds: string[];
  selectAll: boolean;
}

export interface UpdateResult {
  productId: string;
  thresholdValue: string;
  success: boolean;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial threshold state
 * Pure function - no side effects
 */
export function createInitialThresholdState(): ThresholdState {
  return {
    productThresholds: {},
    categoryThresholds: {}
  };
}

/**
 * Create initial filter state
 * Pure function - no side effects
 */
export function createInitialFilterState(): FilterState {
  return {
    search: '',
    category: 'all'
  };
}

/**
 * Create initial mass update state
 * Pure function - no side effects
 */
export function createInitialMassUpdateState(): MassUpdateState {
  return {
    value: '',
    selectedIds: [],
    selectAll: false
  };
}

// ============================================================================
// THRESHOLD INITIALIZATION
// ============================================================================

/**
 * Initialize thresholds from products
 * Pure function - no side effects
 */
export function initializeThresholds(products: Product[]): ThresholdState {
  const productThresholds: Record<string, string> = {};
  const categoryThresholds: Record<string, string> = {};
  
  // Group products by category
  const productsByCategory: Record<string, Product[]> = {};
  
  products.forEach(product => {
    // Convert to string for controlled input
    productThresholds[product.id] = product.threshold !== null && product.threshold !== undefined
      ? String(product.threshold)
      : '';
    
    // Group by category
    if (product.category) {
      if (!productsByCategory[product.category]) {
        productsByCategory[product.category] = [];
      }
      productsByCategory[product.category].push(product);
    }
  });
  
  // Calculate average threshold for each category
  Object.entries(productsByCategory).forEach(([category, categoryProducts]) => {
    let validThresholdCount = 0;
    let thresholdSum = 0;
    
    categoryProducts.forEach(product => {
      if (product.threshold !== null && product.threshold !== undefined) {
        thresholdSum += product.threshold;
        validThresholdCount++;
      }
    });
    
    // If there are products with valid thresholds, calculate average
    if (validThresholdCount > 0) {
      categoryThresholds[category] = String(Math.round(thresholdSum / validThresholdCount));
    } else {
      categoryThresholds[category] = '';
    }
  });
  
  return {
    productThresholds,
    categoryThresholds
  };
}

/**
 * Initialize product thresholds only
 * Pure function - no side effects
 */
export function initializeProductThresholds(products: Product[]): Record<string, string> {
  const thresholds: Record<string, string> = {};
  
  products.forEach(product => {
    thresholds[product.id] = product.threshold !== null && product.threshold !== undefined
      ? String(product.threshold)
      : '';
  });
  
  return thresholds;
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter products by search and category
 * Pure function - no side effects
 */
export function filterProducts(products: Product[], filterState: FilterState): Product[] {
  return products.filter(product => {
    const matchesSearch = filterState.search === '' || 
      product.name.toLowerCase().includes(filterState.search.toLowerCase());
    
    const matchesCategory = filterState.category === 'all' || 
      product.category === filterState.category;
    
    return matchesSearch && matchesCategory;
  });
}

/**
 * Get unique categories from products
 * Pure function - no side effects
 */
export function getUniqueCategories(products: Product[]): string[] {
  return Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
}

/**
 * Filter categories by search
 * Pure function - no side effects
 */
export function filterCategories(categories: string[], products: Product[], searchTerm: string): string[] {
  return categories.filter(category => 
    searchTerm === '' || 
    category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    products.some(p => p.category === category && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
}

/**
 * Get displayed categories based on filter
 * Pure function - no side effects
 */
export function getDisplayedCategories(categories: string[], selectedCategory: string): string[] {
  if (selectedCategory === 'all') {
    return categories;
  }
  return categories.filter(c => c === selectedCategory);
}

// ============================================================================
// THRESHOLD MANAGEMENT
// ============================================================================

/**
 * Update single product threshold in state
 * Pure function - no side effects
 */
export function updateProductThresholdState(
  currentState: Record<string, string>,
  productId: string,
  value: string
): Record<string, string> {
  return {
    ...currentState,
    [productId]: value
  };
}

/**
 * Update single category threshold in state
 * Pure function - no side effects
 */
export function updateCategoryThresholdState(
  currentState: Record<string, string>,
  category: string,
  value: string
): Record<string, string> {
  return {
    ...currentState,
    [category]: value
  };
}

/**
 * Bulk update product thresholds in state
 * Pure function - no side effects
 */
export function bulkUpdateProductThresholds(
  currentState: Record<string, string>,
  updates: Record<string, string>
): Record<string, string> {
  return {
    ...currentState,
    ...updates
  };
}

/**
 * Bulk update category thresholds in state
 * Pure function - no side effects
 */
export function bulkUpdateCategoryThresholds(
  currentState: Record<string, string>,
  updates: Record<string, string>
): Record<string, string> {
  return {
    ...currentState,
    ...updates
  };
}

// ============================================================================
// SELECTION MANAGEMENT
// ============================================================================

/**
 * Toggle single product selection
 * Pure function - no side effects
 */
export function toggleProductSelection(
  currentSelection: string[],
  productId: string
): string[] {
  if (currentSelection.includes(productId)) {
    return currentSelection.filter(id => id !== productId);
  }
  return [...currentSelection, productId];
}

/**
 * Toggle select all products
 * Pure function - no side effects
 */
export function toggleSelectAll(
  currentSelection: string[],
  selectAll: boolean,
  filteredProducts: Product[]
): { selectedIds: string[]; selectAll: boolean } {
  if (selectAll) {
    return { selectedIds: [], selectAll: false };
  }
  return { selectedIds: filteredProducts.map(p => p.id), selectAll: true };
}

/**
 * Clear all selections
 * Pure function - no side effects
 */
export function clearSelections(): { selectedIds: string[]; selectAll: boolean } {
  return { selectedIds: [], selectAll: false };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate threshold value
 * Pure function - no side effects
 */
export function validateThreshold(value: string): { valid: boolean; error?: string } {
  if (value.trim() === '') {
    return { valid: true }; // Empty is valid (means no threshold)
  }
  
  const numValue = parseInt(value, 10);
  
  if (isNaN(numValue)) {
    return { valid: false, error: 'Threshold harus berupa angka' };
  }
  
  if (numValue < 0) {
    return { valid: false, error: 'Threshold tidak boleh negatif' };
  }
  
  if (numValue > 999999) {
    return { valid: false, error: 'Threshold terlalu besar' };
  }
  
  return { valid: true };
}

/**
 * Validate mass update
 * Pure function - no side effects
 */
export function validateMassUpdate(value: string, selectedCount: number): ValidationResult {
  if (value.trim() === '') {
    return { valid: false, error: 'Nilai threshold harus diisi' };
  }
  
  if (selectedCount === 0) {
    return { valid: false, error: 'Pilih minimal satu produk' };
  }
  
  return validateThreshold(value);
}

/**
 * Validate category threshold
 * Pure function - no side effects
 */
export function validateCategoryThreshold(value: string): ValidationResult {
  return validateThreshold(value);
}

/**
 * Check if threshold has changed
 * Pure function - no side effects
 */
export function hasThresholdChanged(currentValue: string, originalValue: string | null | undefined): boolean {
  const normalizedCurrent = currentValue.trim();
  const normalizedOriginal = originalValue === null || originalValue === undefined 
    ? '' 
    : String(originalValue).trim();
  
  return normalizedCurrent !== normalizedOriginal;
}

/**
 * Check if any product threshold has changed
 * Pure function - no side effects
 */
export function hasAnyProductChanged(
  currentThresholds: Record<string, string>,
  products: Product[]
): boolean {
  return products.some(product => 
    hasThresholdChanged(currentThresholds[product.id] || '', product.threshold?.toString() || null)
  );
}

/**
 * Check if any category threshold has changed
 * Pure function - no side effects
 */
export function hasAnyCategoryChanged(
  currentThresholds: Record<string, string>,
  categoryThresholds: Record<string, string>
): boolean {
  return Object.keys(categoryThresholds).some(category => {
    const current = currentThresholds[category] || '';
    const original = categoryThresholds[category] || '';
    return current.trim() !== original.trim();
  });
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate average threshold for category
 * Pure function - no side effects
 */
export function calculateAverageThreshold(products: Product[]): number | null {
  const validThresholds = products
    .map(p => p.threshold)
    .filter((t): t is number => t !== null && t !== undefined);
  
  if (validThresholds.length === 0) {
    return null;
  }
  
  const sum = validThresholds.reduce((acc, t) => acc + t, 0);
  return Math.round(sum / validThresholds.length);
}

/**
 * Count products with valid threshold
 * Pure function - no side effects
 */
export function countProductsWithThreshold(products: Product[]): number {
  return products.filter(p => p.threshold !== null && p.threshold !== undefined).length;
}

/**
 * Count products without threshold
 * Pure function - no side effects
 */
export function countProductsWithoutThreshold(products: Product[]): number {
  return products.filter(p => p.threshold === null || p.threshold === undefined).length;
}

/**
 * Get threshold statistics for category
 * Pure function - no side effects
 */
export function getCategoryThresholdStats(products: Product[]): {
  total: number;
  withThreshold: number;
  withoutThreshold: number;
  average: number | null;
} {
  const withThreshold = products.filter(p => p.threshold !== null && p.threshold !== undefined);
  const withoutThreshold = products.filter(p => p.threshold === null || p.threshold === undefined);
  
  return {
    total: products.length,
    withThreshold: withThreshold.length,
    withoutThreshold: withoutThreshold.length,
    average: calculateAverageThreshold(products)
  };
}

/**
 * Calculate percentage of products with threshold
 * Pure function - no side effects
 */
export function calculateThresholdCoverage(products: Product[]): number {
  if (products.length === 0) return 0;
  return Math.round((countProductsWithThreshold(products) / products.length) * 100);
}

// ============================================================================
// PARSING & FORMATTING
// ============================================================================

/**
 * Parse threshold value to number or null
 * Pure function - no side effects
 */
export function parseThreshold(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Format threshold for display
 * Pure function - no side effects
 */
export function formatThreshold(value: number | null): string {
  if (value === null) return '-';
  return value.toLocaleString('id-ID');
}

/**
 * Format threshold for input
 * Pure function - no side effects
 */
export function formatThresholdForInput(value: number | null): string {
  if (value === null) return '';
  return String(value);
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Compare two threshold values
 * Pure function - no side effects
 */
export function compareThresholds(value1: string | null, value2: string | null): number {
  const num1 = value1 === null ? null : parseInt(String(value1), 10);
  const num2 = value2 === null ? null : parseInt(String(value2), 10);
  
  if (num1 === null && num2 === null) return 0;
  if (num1 === null) return -1;
  if (num2 === null) return 1;
  
  return num1 - num2;
}

/**
 * Check if product threshold matches category average
 * Pure function - no side effects
 */
export function isAtCategoryAverage(
  productThreshold: string | null | undefined,
  categoryAverage: number | null
): boolean {
  if (categoryAverage === null) return true; // No average to compare
  
  const productNum = productThreshold === null || productThreshold === undefined 
    ? null 
    : parseInt(String(productThreshold), 10);
  
  if (productNum === null) return false;
  return productNum === categoryAverage;
}

/**
 * Find products deviating from category average
 * Pure function - no side effects
 */
export function findDeviatingProducts(
  products: Product[],
  categoryAverage: number | null
): Product[] {
  if (categoryAverage === null) return [];
  
  return products.filter(product => 
    product.threshold !== null && 
    product.threshold !== undefined &&
    product.threshold !== categoryAverage
  );
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get threshold distribution
 * Pure function - no side effects
 */
export function getThresholdDistribution(products: Product[]): Record<string, number> {
  const distribution: Record<string, number> = {
    'no-threshold': 0,
    '0-10': 0,
    '11-50': 0,
    '51-100': 0,
    '101-500': 0,
    '500+': 0
  };
  
  products.forEach(product => {
    if (product.threshold === null || product.threshold === undefined) {
      distribution['no-threshold']++;
    } else if (product.threshold <= 10) {
      distribution['0-10']++;
    } else if (product.threshold <= 50) {
      distribution['11-50']++;
    } else if (product.threshold <= 100) {
      distribution['51-100']++;
    } else if (product.threshold <= 500) {
      distribution['101-500']++;
    } else {
      distribution['500+']++;
    }
  });
  
  return distribution;
}

/**
 * Get products needing attention (low threshold)
 * Pure function - no side effects
 */
export function getLowThresholdProducts(products: Product[], threshold: number = 5): Product[] {
  return products.filter(p => 
    p.threshold !== null && 
    p.threshold !== undefined && 
    p.threshold <= threshold
  );
}

/**
 * Get products without threshold
 * Pure function - no side effects
 */
export function getProductsWithoutThreshold(products: Product[]): Product[] {
  return products.filter(p => p.threshold === null || p.threshold === undefined);
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare threshold data for export
 * Pure function - no side effects
 */
export function prepareThresholdExport(products: Product[]): Array<Record<string, string>> {
  return products.map(product => ({
    'Nama Produk': product.name,
    'Kategori': product.category || '-',
    'Threshold': formatThreshold(product.threshold)
  }));
}

/**
 * Get threshold summary for display
 * Pure function - no side effects
 */
export function getThresholdSummary(products: Product[]): {
  total: number;
  withThreshold: number;
  withoutThreshold: number;
  coverage: number;
} {
  const withThreshold = countProductsWithThreshold(products);
  const withoutThreshold = countProductsWithoutThreshold(products);
  
  return {
    total: products.length,
    withThreshold,
    withoutThreshold,
    coverage: calculateThresholdCoverage(products)
  };
}

// ============================================================================
// GROUPING
// ============================================================================

/**
 * Group products by category
 * Pure function - no side effects
 */
export function groupProductsByCategory(products: Product[]): Record<string, Product[]> {
  const grouped: Record<string, Product[]> = {};
  
  products.forEach(product => {
    const category = product.category || 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(product);
  });
  
  return grouped;
}

/**
 * Get categories sorted by product count
 * Pure function - no side effects
 */
export function getCategoriesByCount(categories: string[], products: Product[]): string[] {
  return [...categories].sort((a, b) => {
    const countA = products.filter(p => p.category === a).length;
    const countB = products.filter(p => p.category === b).length;
    return countB - countA; // Descending
  });
}
