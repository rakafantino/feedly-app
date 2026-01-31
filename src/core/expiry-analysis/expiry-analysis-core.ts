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
  expiryDate?: string | Date | null;
  storeId?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  batches?: ProductBatch[];
}

export interface ProductBatch {
  id: string;
  stock: number;
  expiryDate?: string | Date | null;
  batchNumber?: string | null;
  purchasePrice?: number | null;
  productId: string;
  productName?: string;
  unit?: string;
  storeId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpiringProduct extends Product {
  daysLeft: number;
}

export interface ExpiryStatus {
  status: 'expired' | 'critical' | 'warning' | 'attention' | 'good';
  variant: 'destructive' | 'default' | 'secondary' | 'outline';
  message: string;
}

export interface ExpiryFilter {
  status: string;
  category: string;
  search: string;
}

export interface DiscardState {
  batch: ProductBatch | null;
  quantity: string;
  reason: string;
}

export interface GroupedExpiry {
  category: string;
  products: Array<Product & { daysLeft: number }>;
  totalItems: number;
  expiredCount: number;
  criticalCount: number;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial filter state
 * Pure function - no side effects
 */
export function createInitialFilterState(): ExpiryFilter {
  return {
    status: 'all',
    category: 'all',
    search: ''
  };
}

/**
 * Create initial discard state
 * Pure function - no side effects
 */
export function createInitialDiscardState(): DiscardState {
  return {
    batch: null,
    quantity: '',
    reason: ''
  };
}

// ============================================================================
// DATE CALCULATIONS
// ============================================================================

/**
 * Calculate days until expiry
 * Pure function - no side effects
 */
export function calculateDaysUntilExpiry(expiryDate: string | Date | null | undefined): number | null {
  if (!expiryDate) return null;
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get expiry status based on days left
 * Pure function - no side effects
 */
export function getExpiryStatus(daysLeft: number, notificationDays: number = 30): ExpiryStatus {
  if (daysLeft < 0) {
    return { status: 'expired', variant: 'destructive', message: 'Sudah kadaluarsa' };
  }
  if (daysLeft < 7) {
    return { status: 'critical', variant: 'destructive', message: 'Kritis (<7 hari)' };
  }
  if (daysLeft < notificationDays) {
    return { status: 'warning', variant: 'default', message: `Perhatian (<${notificationDays} hari)` };
  }
  if (daysLeft < notificationDays * 2) {
    return { status: 'attention', variant: 'secondary', message: `Perhatian (<${notificationDays * 2} hari)` };
  }
  return { status: 'good', variant: 'outline', message: 'Masih lama' };
}

/**
 * Check if product is expired
 * Pure function - no side effects
 */
export function isExpired(expiryDate: string | Date | null | undefined): boolean {
  const daysLeft = calculateDaysUntilExpiry(expiryDate);
  return daysLeft !== null && daysLeft < 0;
}

/**
 * Check if product is expiring soon
 * Pure function - no side effects
 */
export function isExpiringSoon(expiryDate: string | Date | null | undefined, daysThreshold: number = 30): boolean {
  const daysLeft = calculateDaysUntilExpiry(expiryDate);
  return daysLeft !== null && daysLeft >= 0 && daysLeft < daysThreshold;
}

/**
 * Get expiry color class
 * Pure function - no side effects
 */
export function getExpiryColorClass(daysLeft: number): string {
  if (daysLeft < 0) return 'text-red-600 bg-red-100';
  if (daysLeft < 7) return 'text-orange-600 bg-orange-100';
  if (daysLeft < 30) return 'text-yellow-600 bg-yellow-100';
  return 'text-green-600 bg-green-100';
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter products by expiry status
 * Pure function - no side effects
 */
export function filterByExpiryStatus(products: ExpiringProduct[], status: string): ExpiringProduct[] {
  if (status === 'all') return products;
  
  return products.filter(product => {
    const daysLeft = product.daysLeft;
    
    switch (status) {
      case 'expired':
        return daysLeft < 0;
      case 'critical':
        return daysLeft >= 0 && daysLeft < 7;
      case 'warning':
        return daysLeft >= 7 && daysLeft < 30;
      case 'good':
        return daysLeft >= 30;
      default:
        return true;
    }
  });
}

/**
 * Filter by category
 * Pure function - no side effects
 */
export function filterByCategory(products: ExpiringProduct[], category: string): ExpiringProduct[] {
  if (category === 'all') return products;
  return products.filter(p => p.category === category);
}

/**
 * Search by product name or code
 * Pure function - no side effects
 */
export function searchProducts(products: ExpiringProduct[], query: string): ExpiringProduct[] {
  if (!query.trim()) return products;
  
  const searchTerm = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(searchTerm) ||
    p.product_code?.toLowerCase().includes(searchTerm) ||
    p.barcode?.includes(searchTerm)
  );
}

/**
 * Apply all filters
 * Pure function - no side effects
 */
export function applyFilters(products: ExpiringProduct[], filter: ExpiryFilter): ExpiringProduct[] {
  let result = products;
  result = filterByExpiryStatus(result, filter.status);
  result = filterByCategory(result, filter.category);
  result = searchProducts(result, filter.search);
  return result;
}

/**
 * Get unique categories
 * Pure function - no side effects
 */
export function getUniqueCategories(products: ExpiringProduct[]): string[] {
  const categories = new Set<string>();
  products.forEach(p => {
    if (p.category) categories.add(p.category);
  });
  return Array.from(categories).sort();
}

// ============================================================================
// PROCESSING
// ============================================================================

/**
 * Calculate expiring products with days left
 * Pure function - no side effects
 */
export function calculateExpiringProducts(products: Product[]): Array<Product & { daysLeft: number }> {
  return products
    .map(product => ({
      ...product,
      daysLeft: calculateDaysUntilExpiry(product.expiryDate) ?? 999
    }))
    .filter(product => product.daysLeft < 90); // Only show products expiring within 90 days
}

/**
 * Sort by days left (soonest first)
 * Pure function - no side effects
 */
export function sortByDaysLeft(products: ExpiringProduct[], direction: 'asc' | 'desc' = 'asc'): ExpiringProduct[] {
  return [...products].sort((a, b) => 
    direction === 'asc' ? a.daysLeft - b.daysLeft : b.daysLeft - a.daysLeft
  );
}

/**
 * Group products by category
 * Pure function - no side effects
 */
export function groupByCategory(products: ExpiringProduct[]): GroupedExpiry[] {
  const groups: Record<string, ExpiringProduct[]> = {};
  
  products.forEach(product => {
    const category = product.category || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(product);
  });
  
  return Object.entries(groups).map(([category, prods]) => {
    const sorted = sortByDaysLeft(prods);
    return {
      category,
      products: sorted,
      totalItems: prods.length,
      expiredCount: prods.filter(p => p.daysLeft < 0).length,
      criticalCount: prods.filter(p => p.daysLeft >= 0 && p.daysLeft < 7).length
    };
  }).sort((a, b) => b.totalItems - a.totalItems);
}

/**
 * Toggle group expansion
 * Pure function - no side effects
 */
export function toggleGroupExpansion(current: Record<string, boolean>, groupId: string): Record<string, boolean> {
  return {
    ...current,
    [groupId]: !current[groupId]
  };
}

/**
 * Get display limit
 * Pure function - no side effects
 */
export function getDisplayLimit(current: number, increment: number = 5, max: number = 50): number {
  return Math.min(current + increment, max);
}

/**
 * Reset display limit
 * Pure function - no side effects
 */
export function resetDisplayLimit(): number {
  return 5;
}

// ============================================================================
// DISCARD MANAGEMENT
// ============================================================================

/**
 * Prepare discard state
 * Pure function - no side effects
 */
export function prepareDiscardState(batch: ProductBatch, product: Product): DiscardState {
  return {
    batch: { ...batch, productName: product.name, productId: product.id, unit: product.unit },
    quantity: batch.stock.toString(),
    reason: 'Kadaluarsa'
  };
}

/**
 * Update discard quantity
 * Pure function - no side effects
 */
export function updateDiscardQuantity(current: DiscardState, quantity: string): DiscardState {
  return {
    ...current,
    quantity
  };
}

/**
 * Update discard reason
 * Pure function - no side effects
 */
export function updateDiscardReason(current: DiscardState, reason: string): DiscardState {
  return {
    ...current,
    reason
  };
}

/**
 * Reset discard state
 * Pure function - no side effects
 */
export function resetDiscardState(): DiscardState {
  return createInitialDiscardState();
}

/**
 * Validate discard quantity
 * Pure function - no side effects
 */
export function validateDiscardQuantity(quantity: string, maxQuantity: number): { valid: boolean; error?: string } {
  if (!quantity.trim()) {
    return { valid: false, error: 'Jumlah tidak boleh kosong' };
  }
  
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: 'Jumlah harus lebih dari 0' };
  }
  
  if (qty > maxQuantity) {
    return { valid: false, error: `Jumlah tidak boleh melebihi ${maxQuantity}` };
  }
  
  return { valid: true };
}

/**
 * Build discard payload
 * Pure function - no side effects
 */
export function buildDiscardPayload(params: {
  storeId: string;
  productId: string;
  batchId: string;
  quantity: number;
  reason: string;
}): Record<string, unknown> {
  return {
    storeId: params.storeId,
    productId: params.productId,
    batchId: params.batchId,
    quantity: -Math.abs(params.quantity), // Negative for discard
    type: 'EXPIRED',
    reason: params.reason
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Calculate expiry statistics
 * Pure function - no side effects
 */
export function calculateExpiryStats(products: ExpiringProduct[]): {
  total: number;
  expired: number;
  critical: number;
  warning: number;
  good: number;
  totalValue: number;
} {
  let expired = 0;
  let critical = 0;
  let warning = 0;
  let good = 0;
  let totalValue = 0;
  
  products.forEach(product => {
    if (product.daysLeft < 0) {
      expired++;
    } else if (product.daysLeft < 7) {
      critical++;
    } else if (product.daysLeft < 30) {
      warning++;
    } else {
      good++;
    }
    totalValue += product.stock * product.price;
  });
  
  return {
    total: products.length,
    expired,
    critical,
    warning,
    good,
    totalValue
  };
}

/**
 * Get urgency breakdown
 * Pure function - no side effects
 */
export function getUrgencyBreakdown(products: ExpiringProduct[]): Record<string, number> {
  return {
    expired: products.filter(p => p.daysLeft < 0).length,
    critical: products.filter(p => p.daysLeft >= 0 && p.daysLeft < 7).length,
    warning: products.filter(p => p.daysLeft >= 7 && p.daysLeft < 30).length,
    attention: products.filter(p => p.daysLeft >= 30 && p.daysLeft < 60).length,
    good: products.filter(p => p.daysLeft >= 60).length
  };
}

/**
 * Calculate potential loss
 * Pure function - no side effects
 */
export function calculatePotentialLoss(products: ExpiringProduct[]): number {
  return products
    .filter(p => p.daysLeft < 0)
    .reduce((sum, p) => sum + (p.stock * (p.purchase_price || 0)), 0);
}

/**
 * Get most urgent products
 * Pure function - no side effects
 */
export function getMostUrgentProducts(products: ExpiringProduct[], limit: number = 5): ExpiringProduct[] {
  return sortByDaysLeft(products, 'asc').slice(0, limit);
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatExpiryDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format days left for display
 * Pure function - no side effects
 */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) {
    return `${Math.abs(daysLeft)} hari terlambat`;
  }
  if (daysLeft === 0) {
    return 'Hari ini';
  }
  return `${daysLeft} hari`;
}

/**
 * Get status badge text
 * Pure function - no side effects
 */
export function getStatusBadgeText(status: ExpiryStatus): string {
  return status.message;
}

/**
 * Format stock value
 * Pure function - no side effects
 */
export function formatStockValue(stock: number, unit?: string): string {
  return `${stock.toLocaleString('id-ID')} ${unit || 'pcs'}`;
}

/**
 * Calculate stock value
 * Pure function - no side effects
 */
export function calculateStockValue(price: number, stock: number): number {
  return price * stock;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate expiry filter
 * Pure function - no side effects
 */
export function isValidFilter(): boolean {
  return true; // All filter values are valid
}

/**
 * Check if has expiring products
 * Pure function - no side effects
 */
export function hasExpiringProducts(products: ExpiringProduct[]): boolean {
  return products.length > 0;
}

/**
 * Check if has expired products
 * Pure function - no side effects
 */
export function hasExpiredProducts(products: ExpiringProduct[]): boolean {
  return products.some(p => p.daysLeft < 0);
}

/**
 * Check if has critical products
 * Pure function - no side effects
 */
export function hasCriticalProducts(products: ExpiringProduct[]): boolean {
  return products.some(p => p.daysLeft >= 0 && p.daysLeft < 7);
}

/**
 * Check if can discard
 * Pure function - no side effects
 */
export function canDiscard(state: DiscardState): boolean {
  return !!(state.batch && state.quantity.trim() && parseFloat(state.quantity) > 0);
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare expiry report for export
 * Pure function - no side effects
 */
export function prepareExpiryExport(products: ExpiringProduct[]): Array<Record<string, string>> {
  return products.map(p => ({
    'Nama Produk': p.name,
    'Kode': p.product_code || '-',
    'Kategori': p.category || '-',
    'Tanggal Kadaluarsa': formatExpiryDate(p.expiryDate),
    'Hari Tersisa': formatDaysLeft(p.daysLeft),
    'Stok': p.stock.toString(),
    'Nilai': (p.stock * p.price).toLocaleString('id-ID')
  }));
}

/**
 * Get expiry summary
 * Pure function - no side effects
 */
export function getExpirySummary(stats: ReturnType<typeof calculateExpiryStats>): string {
  return `Total: ${stats.total} | expired: ${stats.expired} | Kritis: ${stats.critical} | Warning: ${stats.warning}`;
}
