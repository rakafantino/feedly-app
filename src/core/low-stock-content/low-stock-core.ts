// ============================================================================
// TYPES
// ============================================================================

export interface TimeFilter {
  value: 'day' | 'week' | 'month';
  label: string;
  days: number;
}

export interface TabOption {
  id: string;
  label: string;
  icon: string;
}

export interface StockAnalytics {
  lowStockCount: number;
  outOfStockCount: number;
  expiringCount: number;
  pendingOrdersCount: number;
  totalProducts: number;
  totalValue: number;
}

export interface CategoryStat {
  name: string;
  count: number;
  value: number;
}

export interface HistoryData {
  date: string;
  count: number;
  value: number;
}

export interface ChartData {
  name: string;
  value: number;
  color: string;
}

export interface ThresholdConfig {
  productId: string;
  threshold: number;
}

export interface StockAdjustment {
  productId: string;
  adjustment: number;
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TIME_FILTERS: TimeFilter[] = [
  { value: 'day', label: 'Hari Ini', days: 1 },
  { value: 'week', label: 'Minggu Ini', days: 7 },
  { value: 'month', label: 'Bulan Ini', days: 30 }
];

export const TAB_OPTIONS: TabOption[] = [
  { id: 'overview', label: 'Ringkasan', icon: 'BarChart3' },
  { id: 'products', label: 'Produk', icon: 'Package' },
  { id: 'purchase', label: 'Pesanan', icon: 'ShoppingCart' },
  { id: 'adjustment', label: 'Penyesuaian', icon: 'ClipboardEdit' }
];

export const CHART_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
];

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Get tab label by ID
 * Pure function - no side effects
 */
export function getTabLabel(tabId: string): string {
  const tab = TAB_OPTIONS.find(t => t.id === tabId);
  return tab?.label || tabId;
}

/**
 * Check if tab is valid
 * Pure function - no side effects
 */
export function isValidTab(tabId: string): boolean {
  return TAB_OPTIONS.some(t => t.id === tabId);
}

/**
 * Get default tab
 * Pure function - no side effects
 */
export function getDefaultTab(): string {
  return 'overview';
}

// ============================================================================
// TIME FILTER HELPERS
// ============================================================================

/**
 * Get days from time filter
 * Pure function - no side effects
 */
export function getDaysFromFilter(filter: TimeFilter): number {
  return filter.days;
}

/**
 * Get filter by value
 * Pure function - no side effects
 */
export function getFilterByValue(value: 'day' | 'week' | 'month'): TimeFilter {
  return TIME_FILTERS.find(f => f.value === value) || TIME_FILTERS[1];
}

/**
 * Create date range from filter
 * Pure function - no side effects
 */
export function createDateRangeFromFilter(filter: TimeFilter): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - filter.days);
  
  return { startDate, endDate };
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate total stock value
 * Pure function - no side effects
 */
export function calculateTotalValue(products: Array<{ price: number; stock: number }>): number {
  return products.reduce((total, product) => {
    return total + (product.price * product.stock);
  }, 0);
}

/**
 * Calculate stock health percentage
 * Pure function - no side effects
 */
export function calculateStockHealth(params: {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
}): number {
  const { totalProducts, lowStock, outOfStock } = params;
  
  if (totalProducts === 0) return 100;
  
  const problematic = lowStock + outOfStock;
  return Math.max(0, Math.round(((totalProducts - problematic) / totalProducts) * 100));
}

/**
 * Calculate reorder urgency score
 * Pure function - no side effects
 */
export function calculateReorderUrgency(params: {
  currentStock: number;
  threshold: number;
  avgDailySales: number;
}): number {
  const { currentStock, threshold, avgDailySales } = params;
  
  if (avgDailySales <= 0) return 0;
  
  const daysUntilEmpty = currentStock / avgDailySales;
  
  // Higher score = more urgent
  if (daysUntilEmpty <= threshold) return 100;
  if (daysUntilEmpty <= threshold * 1.5) return 75;
  if (daysUntilEmpty <= threshold * 2) return 50;
  return 25;
}

/**
 * Calculate category distribution
 * Pure function - no side effects
 */
export function calculateCategoryDistribution(
  products: Array<{ category?: string | null; stock: number; price: number }>
): CategoryStat[] {
  const categoryMap = new Map<string, { count: number; value: number }>();
  
  products.forEach(product => {
    const category = product.category || 'Uncategorized';
    const value = product.stock * product.price;
    
    const existing = categoryMap.get(category) || { count: 0, value: 0 };
    categoryMap.set(category, {
      count: existing.count + 1,
      value: existing.value + value
    });
  });
  
  return Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    ...data
  }));
}

/**
 * Sort categories by value
 * Pure function - no side effects
 */
export function sortCategoriesByValue(categories: CategoryStat[]): CategoryStat[] {
  return [...categories].sort((a, b) => b.value - a.value);
}

/**
 * Calculate days until expiry
 * Pure function - no side effects
 */
export function calculateDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Categorize expiry status
 * Pure function - no side effects
 */
export function getExpiryStatus(daysLeft: number | null): 'expired' | 'critical' | 'warning' | 'safe' {
  if (daysLeft === null) return 'safe';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'warning';
  return 'safe';
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform to chart data
 * Pure function - no side effects
 */
export function transformToChartData(categories: CategoryStat[]): ChartData[] {
  return categories.map((cat, index) => ({
    name: cat.name,
    value: cat.value,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));
}

/**
 * Format number for display
 * Pure function - no side effects
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format percentage for display
 * Pure function - no side effects
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Calculate summary from analytics data
 * Pure function - no side effects
 */
export function calculateSummary(analytics: {
  lowStockCount?: number;
  expiringCount?: number;
  pendingOrdersCount?: number;
  totalProducts?: number;
  categoryStats?: CategoryStat[];
}): StockAnalytics {
  const totalProducts = analytics.totalProducts || 0;
  const lowStock = analytics.lowStockCount || 0;
  const outOfStock = 0; // Would need to be passed in
  const expiring = analytics.expiringCount || 0;
  const pending = analytics.pendingOrdersCount || 0;
  
  const totalValue = analytics.categoryStats?.reduce((sum, cat) => sum + cat.value, 0) || 0;
  
  return {
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    expiringCount: expiring,
    pendingOrdersCount: pending,
    totalProducts,
    totalValue
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate threshold value
 * Pure function - no side effects
 */
export function isValidThreshold(value: number): boolean {
  return value >= 0 && Number.isInteger(value);
}

/**
 * Validate adjustment value
 * Pure function - no side effects
 */
export function isValidAdjustment(value: number): boolean {
  return value !== 0;
}

/**
 * Validate adjustment reason
 * Pure function - no side effects
 */
export function isValidReason(reason: string): boolean {
  return reason.trim().length >= 3;
}

/**
 * Validate stock adjustment request
 * Pure function - no side effects
 */
export function validateStockAdjustment(params: {
  productId: string;
  adjustment: number;
  reason: string;
}): { valid: boolean; error?: string } {
  const { productId, adjustment, reason } = params;
  
  if (!productId) {
    return { valid: false, error: 'Product ID is required' };
  }
  
  if (!isValidAdjustment(adjustment)) {
    return { valid: false, error: 'Adjustment cannot be zero' };
  }
  
  if (!isValidReason(reason)) {
    return { valid: false, error: 'Reason must be at least 3 characters' };
  }
  
  return { valid: true };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create default threshold config
 * Pure function - no side effects
 */
export function createDefaultThresholdConfig(): ThresholdConfig {
  return {
    productId: '',
    threshold: 10
  };
}

/**
 * Create default stock adjustment
 * Pure function - no side effects
 */
export function createDefaultStockAdjustment(): StockAdjustment {
  return {
    productId: '',
    adjustment: 0,
    reason: ''
  };
}

/**
 * Create empty analytics data
 * Pure function - no side effects
 */
export function createEmptyAnalytics(): StockAnalytics {
  return {
    lowStockCount: 0,
    outOfStockCount: 0,
    expiringCount: 0,
    pendingOrdersCount: 0,
    totalProducts: 0,
    totalValue: 0
  };
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Prepare data for export
 * Pure function - no side effects
 */
export function prepareExportData(params: {
  products: Array<{ name: string; stock: number; threshold: number; price: number }>;
  analytics: StockAnalytics;
}): Array<Record<string, string>> {
  const { products, analytics } = params;
  
  return [
    ...products.map(p => ({
      'Nama Produk': p.name,
      'Stok': p.stock.toString(),
      'Threshold': p.threshold.toString(),
      'Harga': p.price.toString(),
      'Nilai': (p.stock * p.price).toString()
    })),
    {},
    {
      'Ringkasan': '',
      'Total Produk': analytics.totalProducts.toString(),
      'Total Nilai': analytics.totalValue.toString(),
      'Stok Rendah': analytics.lowStockCount.toString(),
      'Expired': analytics.expiringCount.toString(),
      'Pesanan Pending': analytics.pendingOrdersCount.toString()
    }
  ];
}

// ============================================================================
// STATIC DATA
// ============================================================================

/**
 * Get color for status
 * Pure function - no side effects
 */
export function getStatusColor(status: 'low' | 'out' | 'expiring' | 'ok'): string {
  switch (status) {
    case 'low': return 'text-yellow-500';
    case 'out': return 'text-red-500';
    case 'expiring': return 'text-orange-500';
    default: return 'text-green-500';
  }
}

/**
 * Get background color for badge
 * Pure function - no side effects
 */
export function getStatusBgColor(status: 'low' | 'out' | 'expiring' | 'ok'): string {
  switch (status) {
    case 'low': return 'bg-yellow-100 text-yellow-800';
    case 'out': return 'bg-red-100 text-red-800';
    case 'expiring': return 'bg-orange-100 text-orange-800';
    default: return 'bg-green-100 text-green-800';
  }
}

/**
 * Get priority level
 * Pure function - no side effects
 */
export function getPriorityLevel(params: {
  daysUntilEmpty: number;
  productValue: number;
}): 'critical' | 'high' | 'medium' | 'low' {
  const { daysUntilEmpty, productValue } = params;
  
  // Critical: less than 3 days or high value product with low stock
  if (daysUntilEmpty < 3 || (daysUntilEmpty < 7 && productValue > 1000000)) {
    return 'critical';
  }
  
  // High: less than 7 days
  if (daysUntilEmpty < 7) {
    return 'high';
  }
  
  // Medium: less than 14 days
  if (daysUntilEmpty < 14) {
    return 'medium';
  }
  
  return 'low';
}
