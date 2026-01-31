// ============================================================================
// TYPES
// ============================================================================

export interface ProductBatch {
  id: string;
  stock: number;
  expiryDate?: string | Date | null;
  batchNumber?: string | null;
  purchasePrice?: number | null;
}

export interface ProductForAdjustment {
  id: string;
  name: string;
  category?: string | null;
  stock: number;
  unit?: string;
  price: number;
  purchase_price?: number | null;
  storeId?: string;
  batches?: ProductBatch[];
}

export interface AdjustmentType {
  value: string;
  label: string;
  description: string;
}

export interface AdjustmentState {
  product: ProductForAdjustment | null;
  batchId: string;
  type: string;
  quantity: string;
  isPositive: boolean;
  reason: string;
}

export interface FilterState {
  search: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Get adjustment types
 * Pure function - no side effects
 */
export function getAdjustmentTypes(): AdjustmentType[] {
  return [
    { value: 'CORRECTION', label: 'Koreksi Stok', description: 'Selisih hasil stock opname' },
    { value: 'WASTE', label: 'Waste/Terbuang', description: 'Barang rusak/pecah' },
    { value: 'DAMAGED', label: 'Rusak', description: 'Barang cacat/tidak layak jual' },
    { value: 'EXPIRED', label: 'Kadaluarsa', description: 'Barang melewati masa pakai' }
  ];
}

/**
 * Get default adjustment type
 * Pure function - no side effects
 */
export function getDefaultAdjustmentType(): string {
  return 'CORRECTION';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial adjustment state
 * Pure function - no side effects
 */
export function createInitialAdjustmentState(): AdjustmentState {
  return {
    product: null,
    batchId: '',
    type: getDefaultAdjustmentType(),
    quantity: '',
    isPositive: false,
    reason: ''
  };
}

/**
 * Create initial filter state
 * Pure function - no side effects
 */
export function createInitialFilterState(): FilterState {
  return {
    search: ''
  };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter products by search query
 * Pure function - no side effects
 */
export function filterProducts(products: ProductForAdjustment[], searchQuery: string): ProductForAdjustment[] {
  if (!searchQuery.trim()) {
    return products;
  }
  
  const query = searchQuery.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.category?.toLowerCase() || '').includes(query)
  );
}

/**
 * Filter products by category
 * Pure function - no side effects
 */
export function filterByCategory(products: ProductForAdjustment[], category: string | null): ProductForAdjustment[] {
  if (!category || category === 'all') {
    return products;
  }
  return products.filter(p => p.category === category);
}

/**
 * Get unique categories from products
 * Pure function - no side effects
 */
export function getUniqueCategories(products: ProductForAdjustment[]): string[] {
  const categories = new Set<string>();
  products.forEach(p => {
    if (p.category) {
      categories.add(p.category);
    }
  });
  return Array.from(categories).sort();
}

/**
 * Filter low stock products
 * Pure function - no side effects
 */
export function getLowStockProducts(products: ProductForAdjustment[], threshold: number = 10): ProductForAdjustment[] {
  return products.filter(p => p.stock <= threshold);
}

/**
 * Filter out of stock products
 * Pure function - no side effects
 */
export function getOutOfStockProducts(products: ProductForAdjustment[]): ProductForAdjustment[] {
  return products.filter(p => p.stock === 0);
}

// ============================================================================
// ADJUSTMENT STATE MANAGEMENT
// ============================================================================

/**
 * Reset adjustment state
 * Pure function - no side effects
 */
export function resetAdjustmentState(): AdjustmentState {
  return createInitialAdjustmentState();
}

/**
 * Update adjustment type
 * Pure function - no side effects
 */
export function updateAdjustmentType(currentState: AdjustmentState, type: string): AdjustmentState {
  return {
    ...currentState,
    type
  };
}

/**
 * Update adjustment quantity
 * Pure function - no side effects
 */
export function updateAdjustmentQuantity(currentState: AdjustmentState, quantity: string): AdjustmentState {
  return {
    ...currentState,
    quantity
  };
}

/**
 * Update adjustment direction (positive/negative)
 * Pure function - no side effects
 */
export function updateAdjustmentDirection(currentState: AdjustmentState, isPositive: boolean): AdjustmentState {
  return {
    ...currentState,
    isPositive
  };
}

/**
 * Update adjustment reason
 * Pure function - no side effects
 */
export function updateAdjustmentReason(currentState: AdjustmentState, reason: string): AdjustmentState {
  return {
    ...currentState,
    reason
  };
}

/**
 * Update selected batch
 * Pure function - no side effects
 */
export function updateSelectedBatch(currentState: AdjustmentState, batchId: string): AdjustmentState {
  return {
    ...currentState,
    batchId
  };
}

/**
 * Update selected product
 * Pure function - no side effects
 */
export function updateSelectedProduct(currentState: AdjustmentState, product: ProductForAdjustment | null): AdjustmentState {
  return {
    ...currentState,
    product,
    batchId: '',
    quantity: '',
    reason: ''
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate adjustment form
 * Pure function - no side effects
 */
export function validateAdjustment(params: {
  selectedProduct: ProductForAdjustment | null;
  quantity: string;
  isPositive: boolean;
  productBatches: ProductBatch[];
  selectedBatchId: string;
  maxQuantity: number;
}): ValidationResult {
  const { selectedProduct, quantity, productBatches, selectedBatchId, maxQuantity } = params;
  
  if (!selectedProduct) {
    return { valid: false, error: 'Pilih produk terlebih dahulu' };
  }
  
  if (!quantity.trim()) {
    return { valid: false, error: 'Lengkapi semua field' };
  }
  
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: 'Jumlah tidak valid' };
  }
  
  // Validate batch selection for products with batches
  if (productBatches.length > 0 && !selectedBatchId) {
    return { valid: false, error: 'Pilih batch terlebih dahulu' };
  }
  
  // Validate negative quantity doesn't exceed stock
  if (!params.isPositive && qty > maxQuantity) {
    return { valid: false, error: `Jumlah melebihi stok tersedia (${maxQuantity})` };
  }
  
  return { valid: true };
}

/**
 * Validate quantity
 * Pure function - no side effects
 */
export function validateQuantity(value: string, max?: number): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: 'Jumlah tidak boleh kosong' };
  }
  
  const qty = parseFloat(value);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, error: 'Jumlah harus lebih dari 0' };
  }
  
  if (max !== undefined && qty > max) {
    return { valid: false, error: `Jumlah tidak boleh melebihi ${max}` };
  }
  
  return { valid: true };
}

/**
 * Validate reason
 * Pure function - no side effects
 */
export function validateReason(reason: string, type: string): ValidationResult {
  const typeInfo = getAdjustmentTypes().find(t => t.value === type);
  // Reason is optional if type has description
  if (!reason.trim() && typeInfo?.description) {
    return { valid: true }; // Optional when type has description
  }
  
  if (reason.trim().length < 3) {
    return { valid: false, error: 'Alasan minimal 3 karakter' };
  }
  
  if (reason.trim().length > 500) {
    return { valid: false, error: 'Alasan maksimal 500 karakter' };
  }
  
  return { valid: true };
}

/**
 * Check if adjustment can be submitted
 * Pure function - no side effects
 */
export function canSubmitAdjustment(state: AdjustmentState, productBatches: ProductBatch[]): boolean {
  if (!state.product) return false;
  if (!state.quantity.trim()) return false;
  
  const qty = parseFloat(state.quantity);
  if (isNaN(qty) || qty <= 0) return false;
  
  if (productBatches.length > 0 && !state.batchId) return false;
  
  if (!state.isPositive) {
    const max = getMaxQuantity(state, productBatches);
    if (qty > max) return false;
  }
  
  return true;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Get max quantity for adjustment
 * Pure function - no side effects
 */
export function getMaxQuantity(state: AdjustmentState, productBatches: ProductBatch[]): number {
  if (state.isPositive) {
    return 9999; // No limit for adding
  }
  
  if (state.batchId && productBatches.length > 0) {
    const batch = productBatches.find(b => b.id === state.batchId);
    return batch?.stock || 0;
  }
  
  return state.product?.stock || 0;
}

/**
 * Calculate new stock after adjustment
 * Pure function - no side effects
 */
export function calculateNewStock(currentStock: number, quantity: string, isPositive: boolean): number {
  const qty = parseFloat(quantity);
  if (isNaN(qty)) return currentStock;
  
  return isPositive 
    ? currentStock + qty 
    : Math.max(0, currentStock - qty);
}

/**
 * Calculate stock difference percentage
 * Pure function - no side effects
 */
export function calculateStockDiffPercentage(currentStock: number, newStock: number): number {
  if (currentStock === 0) {
    return newStock > 0 ? 100 : 0;
  }
  return Math.round(((newStock - currentStock) / currentStock) * 100);
}

/**
 * Get adjustment summary
 * Pure function - no side effects
 */
export function getAdjustmentSummary(params: {
  product: ProductForAdjustment | null;
  quantity: string;
  isPositive: boolean;
  type: string;
}): { originalStock: number; newStock: number; diff: number; typeLabel: string } {
  const { product, quantity, isPositive, type } = params;
  
  if (!product) {
    return {
      originalStock: 0,
      newStock: 0,
      diff: 0,
      typeLabel: ''
    };
  }
  
  const qty = parseFloat(quantity) || 0;
  const newStock = calculateNewStock(product.stock, quantity, isPositive);
  const diff = isPositive ? qty : -qty;
  const typeInfo = getAdjustmentTypes().find(t => t.value === type);
  
  return {
    originalStock: product.stock,
    newStock,
    diff,
    typeLabel: typeInfo?.label || type
  };
}

// ============================================================================
// PARSING & FORMATTING
// ============================================================================

/**
 * Parse quantity to number
 * Pure function - no side effects
 */
export function parseQuantity(value: string): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format quantity for display
 * Pure function - no side effects
 */
export function formatQuantity(value: number): string {
  return value.toLocaleString('id-ID');
}

/**
 * Format stock change for display
 * Pure function - no side effects
 */
export function formatStockChange(currentStock: number, newStock: number): string {
  const diff = newStock - currentStock;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatQuantity(diff)}`;
}

/**
 * Get adjustment type label
 * Pure function - no side effects
 */
export function getAdjustmentTypeLabel(type: string): string {
  const typeInfo = getAdjustmentTypes().find(t => t.value === type);
  return typeInfo?.label || type;
}

/**
 * Get adjustment type description
 * Pure function - no side effects
 */
export function getAdjustmentTypeDescription(type: string): string {
  const typeInfo = getAdjustmentTypes().find(t => t.value === type);
  return typeInfo?.description || '';
}

// ============================================================================
// BATCH MANAGEMENT
// ============================================================================

/**
 * Get available batches for product
 * Pure function - no side effects
 */
export function getAvailableBatches(product: ProductForAdjustment | null): ProductBatch[] {
  if (!product?.batches) return [];
  return product.batches.filter(b => b.stock > 0);
}

/**
 * Get batch display info
 * Pure function - no side effects
 */
export function getBatchDisplayInfo(batch: ProductBatch): string {
  const parts: string[] = [];
  
  if (batch.batchNumber) {
    parts.push(`Batch: ${batch.batchNumber}`);
  }
  
  if (batch.expiryDate) {
    const date = new Date(batch.expiryDate);
    const formatted = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    parts.push(`Exp: ${formatted}`);
  }
  
  parts.push(`Stok: ${batch.stock}`);
  
  return parts.join(' | ');
}

/**
 * Find batch by ID
 * Pure function - no side effects
 */
export function findBatchById(batches: ProductBatch[], batchId: string): ProductBatch | undefined {
  return batches.find(b => b.id === batchId);
}

/**
 * Calculate total batch stock
 * Pure function - no side effects
 */
export function calculateTotalBatchStock(batches: ProductBatch[]): number {
  return batches.reduce((sum, b) => sum + b.stock, 0);
}

/**
 * Check if product has batches
 * Pure function - no side effects
 */
export function hasBatches(product: ProductForAdjustment | null): boolean {
  return !!(product?.batches && product.batches.length > 0);
}

// ============================================================================
// API PAYLOAD
// ============================================================================

/**
 * Build adjustment API payload
 * Pure function - no side effects
 */
export function buildAdjustmentPayload(params: {
  product: ProductForAdjustment | null;
  quantity: string;
  isPositive: boolean;
  type: string;
  reason: string;
  batchId: string;
  productBatches: ProductBatch[];
}): Record<string, unknown> {
  const { product, quantity, isPositive, type, reason, batchId, productBatches } = params;
  
  if (!product) return {};
  
  const qty = parseQuantity(quantity);
  const typeInfo = getAdjustmentTypes().find(t => t.value === type);
  
  return {
    storeId: product.storeId,
    productId: product.id,
    batchId: productBatches.length > 0 ? (batchId || null) : null,
    quantity: isPositive ? qty : -qty,
    type,
    reason: reason || `${typeInfo?.label}`
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get adjustment statistics
 * Pure function - no side effects
 */
export function getAdjustmentStats(products: ProductForAdjustment[]): {
  total: number;
  lowStock: number;
  outOfStock: number;
  withBatches: number;
} {
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const withBatches = products.filter(p => p.batches && p.batches.length > 0).length;
  
  return {
    total: products.length,
    lowStock,
    outOfStock,
    withBatches
  };
}

/**
 * Get products needing adjustment
 * Pure function - no side effects
 */
export function getProductsNeedingAdjustment(products: ProductForAdjustment[]): ProductForAdjustment[] {
  return products.filter(p => p.stock <= 10);
}

/**
 * Get stock health score
 * Pure function - no side effects
 */
export function getStockHealthScore(products: ProductForAdjustment[]): number {
  if (products.length === 0) return 100;
  
  const healthy = products.filter(p => p.stock > 10).length;
  return Math.round((healthy / products.length) * 100);
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare adjustment history for export
 * Pure function - no side effects
 */
export function prepareAdjustmentExport(adjustments: Array<{
  productName: string;
  type: string;
  quantity: number;
  date: string;
}>): Array<Record<string, string>> {
  return adjustments.map(adj => ({
    'Produk': adj.productName,
    'Jenis': adj.type,
    'Jumlah': adj.quantity.toString(),
    'Tanggal': adj.date
  }));
}

/**
 * Get adjustment summary text
 * Pure function - no side effects
 */
export function getAdjustmentSummaryText(product: ProductForAdjustment, newStock: number): string {
  const diff = newStock - product.stock;
  const sign = diff >= 0 ? '+' : '';
  return `${product.name}: ${product.stock} → ${newStock} (${sign}${diff})`;
}
