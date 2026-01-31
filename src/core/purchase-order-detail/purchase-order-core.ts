// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  code?: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  receivedQuantity?: number;
  unit: string;
  price: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  supplier?: Supplier;
  status: string;
  createdAt: string;
  estimatedDelivery: string | null;
  notes: string | null;
  items: PurchaseOrderItem[];
  paymentStatus?: string;
  amountPaid?: number;
  remainingAmount?: number;
  totalAmount?: number;
  dueDate?: string | null;
}

export interface BatchEntry {
  quantity: number;
  expiryDate?: string;
  batchNumber?: string;
}

export type PurchaseOrderStatus = 
  | 'draft' 
  | 'ordered' 
  | 'sent' 
  | 'processing'
  | 'received' 
  | 'partially_received' 
  | 'cancelled'
  | 'completed';

export interface StatusBadgeConfig {
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
  label: string;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Get status badge configuration
 * Pure function - no side effects
 */
export function getStatusBadgeConfig(status: string): StatusBadgeConfig {
  switch (status) {
    case 'draft':
      return { variant: 'outline', label: 'Draft' };
    case 'ordered':
    case 'sent':
    case 'processing':
      return { variant: 'secondary', label: 'Diproses' };
    case 'partially_received':
      return { variant: 'warning' as any, label: 'Partial' };
    case 'received':
    case 'completed':
      return { variant: 'success' as any, label: 'Diterima' };
    case 'cancelled':
      return { variant: 'destructive', label: 'Dibatalkan' };
    default:
      return { variant: 'outline', label: status };
  }
}

/**
 * Check if status allows editing
 * Pure function - no side effects
 */
export function isEditableStatus(status: string): boolean {
  return ['draft', 'ordered'].includes(status);
}

/**
 * Check if status allows receiving goods
 * Pure function - no side effects
 */
export function canReceiveGoods(status: string): boolean {
  return ['ordered', 'sent', 'processing', 'partially_received'].includes(status);
}

/**
 * Check if PO can be cancelled
 * Pure function - no side effects
 */
export function canCancelOrder(status: string): boolean {
  return ['draft', 'ordered', 'sent', 'processing'].includes(status);
}

/**
 * Get next status options
 * Pure function - no side effects
 */
export function getNextStatusOptions(currentStatus: string): string[] {
  const options: string[] = [];
  
  switch (currentStatus) {
    case 'draft':
      options.push('ordered', 'cancelled');
      break;
    case 'ordered':
    case 'sent':
    case 'processing':
      options.push('partially_received', 'cancelled');
      break;
    case 'partially_received':
      options.push('received');
      break;
  }
  
  return options;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate total received quantity from batches
 * Pure function - no side effects
 */
export function calculateTotalReceived(batches: BatchEntry[]): number {
  return batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
}

/**
 * Calculate PO total amount
 * Pure function - no side effects
 */
export function calculateOrderTotal(items: PurchaseOrderItem[]): number {
  return items.reduce((total, item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    return total + (quantity * price);
  }, 0);
}

/**
 * Calculate remaining amount
 * Pure function - no side effects
 */
export function calculateRemainingAmount(totalAmount: number, amountPaid: number): number {
  return Math.max(totalAmount - amountPaid, 0);
}

/**
 * Calculate payment progress percentage
 * Pure function - no side effects
 */
export function calculatePaymentProgress(amountPaid: number, totalAmount: number): number {
  if (totalAmount <= 0) return 0;
  return Math.min((amountPaid / totalAmount) * 100, 100);
}

/**
 * Check if order is fully paid
 * Pure function - no side effects
 */
export function isFullyPaid(amountPaid: number, totalAmount: number): boolean {
  return amountPaid >= totalAmount;
}

/**
 * Calculate item subtotal
 * Pure function - no side effects
 */
export function calculateItemSubtotal(quantity: string, price: string): number {
  const qty = parseFloat(quantity) || 0;
  const prc = parseFloat(price) || 0;
  return qty * prc;
}

/**
 * Calculate remaining quantity to receive
 * Pure function - no side effects
 */
export function calculateRemainingQuantity(ordered: string, received?: number): number {
  const orderedQty = parseFloat(ordered) || 0;
  const receivedQty = received || 0;
  return Math.max(orderedQty - receivedQty, 0);
}

// ============================================================================
// BATCH MANAGEMENT
// ============================================================================

/**
 * Create new batch entry
 * Pure function - no side effects
 */
export function createBatchEntry(): BatchEntry {
  return {
    quantity: 0,
    batchNumber: '',
    expiryDate: ''
  };
}

/**
 * Update batch entry field
 * Pure function - no side effects
 */
export function updateBatchEntry(
  batches: BatchEntry[],
  index: number,
  field: keyof BatchEntry,
  value: any
): BatchEntry[] {
  const updated = [...batches];
  if (index >= 0 && index < updated.length) {
    updated[index] = { ...updated[index], [field]: value };
  }
  return updated;
}

/**
 * Add new batch row
 * Pure function - no side effects
 */
export function addBatchRow(batches: BatchEntry[]): BatchEntry[] {
  return [...batches, createBatchEntry()];
}

/**
 * Remove batch row
 * Pure function - no side effects
 */
export function removeBatchRow(batches: BatchEntry[], index: number): BatchEntry[] {
  if (index < 0 || index >= batches.length) return batches;
  return batches.filter((_, i) => i !== index);
}

/**
 * Filter valid batches (non-zero quantity)
 * Pure function - no side effects
 */
export function filterValidBatches(batches: BatchEntry[]): BatchEntry[] {
  return batches.filter(batch => batch.quantity > 0);
}

/**
 * Check if batches are valid for submission
 * Pure function - no side effects
 */
export function validateBatches(batches: BatchEntry[]): { valid: boolean; error?: string } {
  const totalReceived = calculateTotalReceived(batches);
  
  if (totalReceived === 0) {
    return { valid: false, error: 'Jumlah received tidak boleh 0' };
  }
  
  // Check for negative quantities
  if (batches.some(b => b.quantity < 0)) {
    return { valid: false, error: 'Jumlah tidak boleh negatif' };
  }
  
  return { valid: true };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate receive goods request
 * Pure function - no side effects
 */
export function validateReceiveGoods(params: {
  itemsToReceive: Array<{ id: string; receivedQuantity: number }>;
  closePo: boolean;
}): { valid: boolean; error?: string } {
  const { itemsToReceive, closePo } = params;
  
  if (itemsToReceive.length === 0 && !closePo) {
    return { valid: false, error: 'Masukkan jumlah yang diterima atau tandai PO selesai' };
  }
  
  const hasValidQuantity = itemsToReceive.some(item => item.receivedQuantity > 0);
  if (!hasValidQuantity && !closePo) {
    return { valid: false, error: 'Minimal satu item harus memiliki jumlah diterima' };
  }
  
  return { valid: true };
}

/**
 * Validate payment amount
 * Pure function - no side effects
 */
export function validatePaymentAmount(params: {
  paymentAmount: number;
  remainingAmount: number;
  currentAmountPaid: number;
}): { valid: boolean; error?: string } {
  const { paymentAmount, remainingAmount, currentAmountPaid } = params;
  
  if (paymentAmount <= 0) {
    return { valid: false, error: 'Jumlah pembayaran harus lebih dari 0' };
  }
  
  if (paymentAmount > remainingAmount) {
    return { valid: false, error: 'Jumlah pembayaran melebihi sisa tagihan' };
  }
  
  // Check if already paid
  if (currentAmountPaid >= remainingAmount) {
    return { valid: false, error: 'Tagihan sudah lunas' };
  }
  
  return { valid: true };
}

/**
 * Validate status update
 * Pure function - no side effects
 */
export function validateStatusUpdate(params: {
  currentStatus: string;
  newStatus: string;
}): { valid: boolean; error?: string } {
  const { currentStatus, newStatus } = params;
  
  if (currentStatus === newStatus) {
    return { valid: false, error: 'Status tidak berubah' };
  }
  
  const validOptions = getNextStatusOptions(currentStatus);
  if (!validOptions.includes(newStatus)) {
    return { valid: false, error: 'Transisi status tidak valid' };
  }
  
  return { valid: true };
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform batches to API format
 * Pure function - no side effects
 */
export function transformBatchesForApi(batches: BatchEntry[]) {
  return filterValidBatches(batches).map(batch => ({
    quantity: batch.quantity,
    batchNumber: batch.batchNumber || null,
    expiryDate: batch.expiryDate || null
  }));
}

/**
 * Transform receive items for API
 * Pure function - no side effects
 */
export function transformReceiveItemsForApi(params: {
  items: PurchaseOrderItem[];
  batches: Record<string, BatchEntry[]>;
  closePo: boolean;
}): Array<{ id: string; receivedQuantity: number; batches: ReturnType<typeof transformBatchesForApi> }> {
  const { items, batches, closePo } = params;
  
  return items
    .map(item => {
      const itemBatches = batches[item.id] || [];
      const totalReceived = calculateTotalReceived(itemBatches);
      
      return {
        id: item.id,
        receivedQuantity: totalReceived,
        batches: transformBatchesForApi(itemBatches)
      };
    })
    .filter(item => item.receivedQuantity > 0 || closePo);
}

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format currency for display
 * Pure function - no side effects
 */
export function formatCurrencyForDisplay(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Check if all items are fully received
 * Pure function - no side effects
 */
export function isOrderFullyReceived(items: PurchaseOrderItem[]): boolean {
  return items.every(item => {
    const ordered = parseFloat(item.quantity) || 0;
    const received = item.receivedQuantity || 0;
    return received >= ordered;
  });
}

/**
 * Check if any items are partially received
 * Pure function - no side effects
 */
export function isOrderPartiallyReceived(items: PurchaseOrderItem[]): boolean {
  const hasReceived = items.some(item => (item.receivedQuantity || 0) > 0);
  const allReceived = items.every(item => {
    const ordered = parseFloat(item.quantity) || 0;
    const received = item.receivedQuantity || 0;
    return received >= ordered;
  });
  return hasReceived && !allReceived;
}

/**
 * Get payment status badge type
 * Pure function - no side effects
 */
export function getPaymentStatusType(paymentStatus: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (paymentStatus) {
    case 'PAID':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'UNPAID':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Calculate items progress
 * Pure function - no side effects
 */
export function calculateItemsProgress(items: PurchaseOrderItem[]): {
  totalItems: number;
  receivedItems: number;
  percentage: number;
} {
  const totalItems = items.length;
  const receivedItems = items.filter(item => {
    const ordered = parseFloat(item.quantity) || 0;
    const received = item.receivedQuantity || 0;
    return received >= ordered;
  }).length;
  
  const percentage = totalItems > 0 ? (receivedItems / totalItems) * 100 : 0;
  
  return { totalItems, receivedItems, percentage };
}

/**
 * Generate empty batches map for items
 * Pure function - no side effects
 */
export function initializeBatchesMap(items: PurchaseOrderItem[]): Record<string, BatchEntry[]> {
  const batchesMap: Record<string, BatchEntry[]> = {};
  
  items.forEach(item => {
    batchesMap[item.id] = [];
  });
  
  return batchesMap;
}

/**
 * Check if PO can be closed
 * Pure function - no side effects
 */
export function canClosePo(params: {
  items: PurchaseOrderItem[];
  paymentStatus?: string;
}): boolean {
  const { items, paymentStatus } = params;
  
  // Can close if all items received or payment completed
  const allItemsReceived = isOrderFullyReceived(items);
  const paymentCompleted = paymentStatus === 'PAID';
  
  return allItemsReceived || paymentCompleted;
}
