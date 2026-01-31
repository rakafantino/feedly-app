// ============================================================================
// TYPES
// ============================================================================

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: string | number;
  unit: string;
  price: string | number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  createdAt: string;
  estimatedDelivery: string | null;
  notes: string | null | undefined;
  items: PurchaseOrderItem[];
  paymentStatus?: string;
  amountPaid?: number;
  remainingAmount?: number;
  dueDate?: string;
}

export interface PurchaseOrdersListProps {
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
  refreshData?: () => Promise<void>;
}

export interface FilterState {
  search: string;
  status: string;
  supplier: string;
  dateFrom: string;
  dateTo: string;
}

export interface SortState {
  field: keyof PurchaseOrder | 'totalAmount';
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
}

// ============================================================================
// STATUS HELPERS (Shared with PurchaseOrderDetail)
// ============================================================================

export type PurchaseOrderStatus = 
  | 'draft' 
  | 'ordered' 
  | 'sent' 
  | 'processing'
  | 'received' 
  | 'partially_received' 
  | 'cancelled'
  | 'completed';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface StatusBadgeConfig {
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  label: string;
}

/**
 * Get status badge configuration
 * Pure function - no side effects
 */
export function getPurchaseOrderStatusBadge(status: string): StatusBadgeConfig {
  switch (status) {
    case 'draft':
      return { variant: 'outline', label: 'Draft' };
    case 'ordered':
    case 'sent':
    case 'processing':
      return { variant: 'secondary', label: 'Diproses' };
    case 'partially_received':
      return { variant: 'warning', label: 'Partial' };
    case 'received':
    case 'completed':
      return { variant: 'success', label: 'Diterima' };
    case 'cancelled':
      return { variant: 'destructive', label: 'Dibatalkan' };
    default:
      return { variant: 'outline', label: status };
  }
}

/**
 * Get payment status badge configuration
 * Pure function - no side effects
 */
export function getPaymentStatusBadge(status: string | undefined): StatusBadgeConfig {
  switch (status) {
    case 'PAID':
      return { variant: 'success', label: 'Lunas' };
    case 'PARTIAL':
      return { variant: 'warning', label: 'Partial' };
    case 'UNPAID':
      return { variant: 'destructive', label: 'Belum Lunas' };
    default:
      return { variant: 'secondary', label: '-' };
  }
}

/**
 * Check if order can be edited
 * Pure function - no side effects
 */
export function canEditOrder(status: string): boolean {
  return ['draft', 'ordered'].includes(status);
}

/**
 * Check if order can be deleted
 * Pure function - no side effects
 */
export function canDeleteOrder(status: string): boolean {
  return status === 'draft';
}

/**
 * Check if order can be viewed
 * Pure function - no side effects
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canViewOrder(_status: string): boolean {
  return true; // All statuses can be viewed
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate order total amount
 * Pure function - no side effects
 */
export function calculateOrderTotalAmount(items: PurchaseOrderItem[]): number {
  return items.reduce((total, item) => {
    const quantity = typeof item.quantity === 'string' 
      ? parseFloat(item.quantity) || 0 
      : item.quantity;
    const price = typeof item.price === 'string' 
      ? parseFloat(item.price) || 0 
      : item.price;
    return total + (quantity * price);
  }, 0);
}

/**
 * Calculate item count
 * Pure function - no side effects
 */
export function calculateItemCount(items: PurchaseOrderItem[]): number {
  return items.reduce((count, item) => {
    const quantity = typeof item.quantity === 'string' 
      ? parseFloat(item.quantity) || 0 
      : item.quantity;
    return count + quantity;
  }, 0);
}

/**
 * Calculate remaining payment
 * Pure function - no side effects
 */
export function calculateRemaining(totalAmount: number, amountPaid: number | undefined): number {
  const paid = amountPaid || 0;
  return Math.max(totalAmount - paid, 0);
}

/**
 * Calculate payment progress percentage
 * Pure function - no side effects
 */
export function calculatePaymentProgress(totalAmount: number, amountPaid: number | undefined): number {
  if (totalAmount <= 0) return 0;
  const paid = amountPaid || 0;
  return Math.min((paid / totalAmount) * 100, 100);
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Check if order matches search query
 * Pure function - no side effects
 */
export function matchesSearch(order: PurchaseOrder, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  
  const query = searchQuery.toLowerCase().trim();
  
  return (
    order.poNumber.toLowerCase().includes(query) ||
    order.supplierName.toLowerCase().includes(query) ||
    order.items.some(item => item.productName.toLowerCase().includes(query))
  );
}

/**
 * Check if order matches status filter
 * Pure function - no side effects
 */
export function matchesStatus(order: PurchaseOrder, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  return order.status === statusFilter;
}

/**
 * Check if order matches supplier filter
 * Pure function - no side effects
 */
export function matchesSupplier(order: PurchaseOrder, supplierFilter: string): boolean {
  if (supplierFilter === 'all') return true;
  return order.supplierId === supplierFilter;
}

/**
 * Check if order matches date range
 * Pure function - no side effects
 */
export function matchesDateRange(order: PurchaseOrder, dateFrom: string, dateTo: string): boolean {
  const orderDate = new Date(order.createdAt);
  
  if (dateFrom && orderDate < new Date(dateFrom)) return false;
  if (dateTo && orderDate > new Date(dateTo + 'T23:59:59')) return false;
  
  return true;
}

/**
 * Apply all filters to orders
 * Pure function - no side effects
 */
export function applyFilters(
  orders: PurchaseOrder[],
  filters: FilterState
): PurchaseOrder[] {
  return orders.filter(order => 
    matchesSearch(order, filters.search) &&
    matchesStatus(order, filters.status) &&
    matchesSupplier(order, filters.supplier) &&
    matchesDateRange(order, filters.dateFrom, filters.dateTo)
  );
}

/**
 * Get unique suppliers from orders
 * Pure function - no side effects
 */
export function getUniqueSuppliers(orders: PurchaseOrder[]): Array<{ id: string; name: string }> {
  const supplierMap = new Map<string, string>();
  
  orders.forEach(order => {
    if (order.supplierId && order.supplierName) {
      supplierMap.set(order.supplierId, order.supplierName);
    }
  });
  
  return Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Get unique statuses from orders
 * Pure function - no side effects
 */
export function getUniqueStatuses(orders: PurchaseOrder[]): string[] {
  const statuses = new Set<string>();
  orders.forEach(order => statuses.add(order.status));
  return Array.from(statuses);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Get sort value for order
 * Pure function - no side effects
 */
function getSortValue(order: PurchaseOrder, field: keyof PurchaseOrder | 'totalAmount'): string | number | Date {
  switch (field) {
    case 'totalAmount':
      return calculateOrderTotalAmount(order.items);
    case 'createdAt':
    case 'estimatedDelivery':
    case 'dueDate':
      return new Date(order[field] || 0);
    default:
      return order[field] as string;
  }
}

/**
 * Sort orders by field and direction
 * Pure function - no side effects
 */
export function sortOrders(
  orders: PurchaseOrder[],
  sortState: SortState
): PurchaseOrder[] {
  const { field, direction } = sortState;
  
  return [...orders].sort((a, b) => {
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
 * Toggle sort direction for a field
 * Pure function - no side effects
 */
export function toggleSort(
  currentSort: SortState,
  field: keyof PurchaseOrder | 'totalAmount'
): SortState {
  if (currentSort.field === field) {
    return {
      field,
      direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
    };
  }
  
  return {
    field,
    direction: 'desc' // Default to descending for new field
  };
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Calculate pagination values
 * Pure function - no side effects
 */
export function calculatePagination(
  totalItems: number,
  pageSize: number
): {
  totalPages: number;
  startIndex: number;
  endIndex: number;
} {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    totalPages,
    startIndex: 0,
    endIndex: Math.min(pageSize, totalItems)
  };
}

/**
 * Get paginated orders
 * Pure function - no side effects
 */
export function getPaginatedOrders(
  orders: PurchaseOrder[],
  pagination: PaginationState
): PurchaseOrder[] {
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  return orders.slice(start, end);
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
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): number[] {
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

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Format date for display
 * Pure function - no side effects
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
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

/**
 * Get status counts for summary
 * Pure function - no side effects
 */
export function getStatusCounts(orders: PurchaseOrder[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  orders.forEach(order => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });
  
  return counts;
}

/**
 * Get payment summary
 * Pure function - no side effects
 */
export function getPaymentSummary(orders: PurchaseOrder[]): {
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  paidCount: number;
  unpaidCount: number;
} {
  let totalAmount = 0;
  let totalPaid = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  
  orders.forEach(order => {
    const amount = calculateOrderTotalAmount(order.items);
    const paid = order.amountPaid || 0;
    
    totalAmount += amount;
    totalPaid += paid;
    
    if (order.paymentStatus === 'PAID') {
      paidCount++;
    } else if (order.paymentStatus === 'UNPAID') {
      unpaidCount++;
    }
  });
  
  return {
    totalAmount,
    totalPaid,
    totalRemaining: totalAmount - totalPaid,
    paidCount,
    unpaidCount
  };
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
    status: 'all',
    supplier: 'all',
    dateFrom: '',
    dateTo: ''
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

/**
 * Create initial pagination state
 * Pure function - no side effects
 */
export function createInitialPaginationState(): PaginationState {
  return {
    page: 1,
    pageSize: 10
  };
}

/**
 * Reset filters to initial state
 * Pure function - no side effects
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function resetFilters(_currentFilters: FilterState): FilterState {
  return createInitialFilterState();
}

/**
 * Reset pagination to first page
 * Pure function - no side effects
 */
export function resetPagination(currentPagination: PaginationState): PaginationState {
  return {
    ...currentPagination,
    page: 1
  };
}

// ============================================================================
// BULK ACTIONS
// ============================================================================

/**
 * Check if any orders are selected
 * Pure function - no side effects
 */
export function hasSelectedOrders(selectedIds: Set<string>): boolean {
  return selectedIds.size > 0;
}

/**
 * Check if all selected orders can be deleted
 * Pure function - no side effects
 */
export function canDeleteSelected(orders: PurchaseOrder[], selectedIds: Set<string>): boolean {
  return Array.from(selectedIds).every(id => {
    const order = orders.find(o => o.id === id);
    return order && canDeleteOrder(order.status);
  });
}

/**
 * Get selected order IDs
 * Pure function - no side effects
 */
export function getSelectedIds(order: PurchaseOrder): string {
  return order.id;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Prepare orders for export
 * Pure function - no side effects
 */
export function prepareForExport(orders: PurchaseOrder[]): Array<Record<string, string>> {
  return orders.map(order => ({
    'No. PO': order.poNumber,
    'Supplier': order.supplierName,
    'Status': order.status,
    'Tanggal': formatDateForDisplay(order.createdAt),
    'Total': formatCurrencyForDisplay(calculateOrderTotalAmount(order.items)),
    'Status Pembayaran': order.paymentStatus || '-'
  }));
}
