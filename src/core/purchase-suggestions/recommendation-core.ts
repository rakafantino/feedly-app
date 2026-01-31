import { Product } from '@/types/product';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductRecommendation {
  productId: string;
  averageSales: number;
  daysToEmpty: number;
  recommendedOrder: number;
  salesTrend: 'up' | 'down' | 'stable';
}

export interface SalesData {
  salesByProduct: Record<string, number[]>;
  averageDailySales: Record<string, number>;
  salesTrend: Record<string, 'up' | 'down' | 'stable'>;
}

export interface OrderCalculation {
  productId: string;
  quantity: number;
  total: number;
}

export interface PurchaseOrderData {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: OrderCalculation[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

// ============================================================================
// PURE FUNCTIONS - SALES DATA PROCESSING
// ============================================================================

/**
 * Parse transactions and group sales by product
 * Pure function - no side effects
 */
export function parseSalesData(
  transactions: Array<{ items?: Array<{ productId: string; quantity: number }> }>
): Record<string, number[]> {
  const sales: Record<string, number[]> = {};
  
  transactions.forEach(tx => {
    if (!tx.items) return;
    
    tx.items.forEach(item => {
      if (!sales[item.productId]) {
        sales[item.productId] = [];
      }
      sales[item.productId].push(item.quantity);
    });
  });
  
  return sales;
}

/**
 * Calculate average daily sales and trends from raw sales data
 * Pure function - no side effects
 */
export function calculateSalesAnalysis(
  sales: Record<string, number[]>,
  lookbackDays: number = 30
): { averageDailySales: Record<string, number>; salesTrend: Record<string, 'up' | 'down' | 'stable'> } {
  const averageDailySales: Record<string, number> = {};
  const salesTrend: Record<string, 'up' | 'down' | 'stable'> = {};
  
  const halfPoint = Math.floor(lookbackDays / 2);
  
  Object.entries(sales).forEach(([productId, quantities]) => {
    // Calculate average daily sales
    const total = quantities.reduce((sum, qty) => sum + qty, 0);
    averageDailySales[productId] = total / lookbackDays;
    
    // Calculate trend based on first half vs second half
    if (quantities.length > halfPoint) {
      const firstHalf = quantities.slice(0, halfPoint).reduce((sum, qty) => sum + qty, 0);
      const secondHalf = quantities.slice(halfPoint).reduce((sum, qty) => sum + qty, 0);
      
      const firstHalfAvg = firstHalf / halfPoint;
      const secondHalfAvg = secondHalf / halfPoint;
      
      if (secondHalfAvg > firstHalfAvg * 1.1) {
        salesTrend[productId] = 'up';
      } else if (secondHalfAvg < firstHalfAvg * 0.9) {
        salesTrend[productId] = 'down';
      } else {
        salesTrend[productId] = 'stable';
      }
    } else {
      salesTrend[productId] = 'stable';
    }
  });
  
  return { averageDailySales, salesTrend };
}

/**
 * Calculate days until stock runs out
 * Pure function - no side effects
 */
export function calculateDaysToEmpty(
  currentStock: number,
  averageDailySales: number
): number {
  if (averageDailySales <= 0) return 999;
  return Math.floor(currentStock / averageDailySales);
}

// ============================================================================
// PURE FUNCTIONS - RECOMMENDATION LOGIC
// ============================================================================

/**
 * Calculate recommended order quantity based on sales trend
 * Pure function - no side effects
 */
export function calculateRecommendedOrder(params: {
  currentStock: number;
  threshold: number | null | undefined;
  averageDailySales: number;
  trend: 'up' | 'down' | 'stable';
  minOrderIncrement?: number;
}): number {
  const { currentStock, threshold, averageDailySales, trend, minOrderIncrement = 3 } = params;
  
  // Determine forecast days based on trend
  // - Up trend: 45 days (1.5x normal)
  // - Stable: 30 days (normal)
  // - Down trend: 20 days (0.67x normal)
  const forecastDays = trend === 'up' ? 45 : trend === 'down' ? 20 : 30;
  
  // Calculate needed quantity
  const neededQuantity = Math.ceil(averageDailySales * forecastDays);
  const recommendedOrder = Math.max(neededQuantity - currentStock, 0);
  
  // Apply minimum order threshold for efficiency
  if (recommendedOrder > 0 && recommendedOrder < minOrderIncrement) {
    return minOrderIncrement;
  }
  
  // Fallback: if no sales data but below threshold, order to 2x threshold
  if (averageDailySales <= 0 && threshold && currentStock <= threshold) {
    return Math.max(threshold * 2 - currentStock, 1);
  }
  
  return recommendedOrder;
}

/**
 * Generate all product recommendations
 * Pure function - no side effects
 */
export function generateRecommendations(params: {
  products: Product[];
  averageDailySales: Record<string, number>;
  salesTrend: Record<string, 'up' | 'down' | 'stable'>;
  maxDaysUntilEmpty?: number;
}): Record<string, ProductRecommendation> {
  const { products, averageDailySales, salesTrend, maxDaysUntilEmpty = 30 } = params;
  
  const recommendations: Record<string, ProductRecommendation> = {};
  
  products.forEach(product => {
    const avgSales = averageDailySales[product.id] || 0;
    const trend = salesTrend[product.id] || 'stable';
    const daysToEmpty = calculateDaysToEmpty(product.stock, avgSales);
    
    const recommendedOrder = calculateRecommendedOrder({
      currentStock: product.stock,
      threshold: product.threshold,
      averageDailySales: avgSales,
      trend
    });
    
    // Only include if there's a recommendation or running low soon
    if (recommendedOrder > 0 || daysToEmpty < maxDaysUntilEmpty) {
      recommendations[product.id] = {
        productId: product.id,
        averageSales: avgSales,
        daysToEmpty,
        recommendedOrder,
        salesTrend: trend
      };
    }
  });
  
  return recommendations;
}

/**
 * Initialize order quantities based on recommendations or defaults
 * Pure function - no side effects
 */
export function initializeOrderQuantities(params: {
  products: Product[];
  recommendations?: Record<string, ProductRecommendation>;
  defaultOrderQty?: number;
}): Record<string, number> {
  const { products, recommendations, defaultOrderQty = 10 } = params;
  
  const quantities: Record<string, number> = {};
  
  products.forEach(product => {
    if (recommendations?.[product.id]) {
      // Use recommendation
      quantities[product.id] = recommendations[product.id].recommendedOrder;
    } else if (product.threshold) {
      // Calculate based on threshold: 2x threshold - current stock
      quantities[product.id] = Math.max(product.threshold * 2 - product.stock, 1);
    } else {
      // Use default
      quantities[product.id] = defaultOrderQty;
    }
  });
  
  return quantities;
}

// ============================================================================
// PURE FUNCTIONS - ORDER VALIDATION & CALCULATION
// ============================================================================

/**
 * Validate order selection
 * Pure function - no side effects
 */
export function validateOrder(params: {
  selectedProductIds: string[];
  products: Product[];
  orderQuantities: Record<string, number>;
  supplierId?: string;
}): { valid: boolean; error?: string } {
  const { selectedProductIds, supplierId } = params;
  
  if (selectedProductIds.length === 0) {
    return { valid: false, error: 'Pilih minimal satu produk untuk membuat pesanan' };
  }
  
  if (!supplierId) {
    return { valid: false, error: 'Pilih supplier terlebih dahulu' };
  }
  
  return { valid: true };
}

/**
 * Calculate total order cost
 * Pure function - no side effects
 */
export function calculateTotalCost(params: {
  selectedProductIds: string[];
  products: Product[];
  orderQuantities: Record<string, number>;
}): number {
  const { selectedProductIds, products, orderQuantities } = params;
  
  return selectedProductIds.reduce((total, productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return total;
    
    const quantity = orderQuantities[productId] || 0;
    return total + (product.price * quantity);
  }, 0);
}

/**
 * Build order items for purchase order
 * Pure function - no side effects
 */
export function buildOrderItems(params: {
  selectedProductIds: string[];
  products: Product[];
  orderQuantities: Record<string, number>;
}): OrderCalculation[] {
  const { selectedProductIds, products, orderQuantities } = params;
  
  return selectedProductIds
    .map(productId => {
      const product = products.find(p => p.id === productId);
      if (!product) return null;
      
      const quantity = orderQuantities[productId] || 0;
      if (quantity <= 0) return null;
      
      return {
        productId,
        quantity,
        total: product.price * quantity
      };
    })
    .filter((item): item is OrderCalculation => item !== null);
}

/**
 * Build purchase order data structure
 * Pure function - no side effects
 */
export function buildPurchaseOrderData(params: {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: OrderCalculation[];
  totalAmount: number;
  status?: string;
}): PurchaseOrderData {
  const { poNumber, supplierId, supplierName, items, totalAmount, status = 'pending' } = params;
  
  const enrichedItems = items.map(item => {
    const product = { name: 'Product' }; // Would need product lookup in shell
    return {
      ...item,
      productName: product.name
    };
  });
  
  return {
    poNumber,
    supplierId,
    supplierName,
    items: enrichedItems,
    totalAmount,
    status,
    createdAt: new Date().toISOString()
  };
}

// ============================================================================
// PURE FUNCTIONS - UI HELPERS
// ============================================================================

export type ProductStatus = 'critical' | 'warning' | 'normal';

export interface StatusInfo {
  status: ProductStatus;
  message: string;
}

/**
 * Get product status based on days to empty
 * Pure function - no side effects
 */
export function getProductStatus(params: {
  daysToEmpty: number;
  criticalThreshold?: number;
  warningThreshold?: number;
}): StatusInfo {
  const { daysToEmpty, criticalThreshold = 7, warningThreshold = 14 } = params;
  
  if (daysToEmpty <= criticalThreshold) {
    return {
      status: 'critical',
      message: `Stok habis dalam ${daysToEmpty} hari`
    };
  } else if (daysToEmpty <= warningThreshold) {
    return {
      status: 'warning',
      message: `Stok habis dalam ${daysToEmpty} hari`
    };
  } else {
    return {
      status: 'normal',
      message: `Stok cukup untuk ${daysToEmpty} hari`
    };
  }
}

/**
 * Check if all products are selected
 * Pure function - no side effects
 */
export function checkSelectAll(
  selectedIds: string[],
  productIds: string[]
): boolean {
  if (productIds.length === 0) return false;
  return productIds.every(id => selectedIds.includes(id));
}

/**
 * Toggle product selection
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
 * Update order quantity for a product
 * Pure function - no side effects
 */
export function updateOrderQuantity(
  currentQuantities: Record<string, number>,
  productId: string,
  quantity: number
): Record<string, number> {
  if (quantity <= 0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [productId]: _removed, ...rest } = currentQuantities;
    return rest;
  }
  return {
    ...currentQuantities,
    [productId]: quantity
  };
}

/**
 * Format product list for export
 * Pure function - no side effects
 */
export function formatForExport(params: {
  products: Product[];
  orderQuantities: Record<string, number>;
  includeHeaders?: boolean;
}): string {
  const { products, orderQuantities, includeHeaders = true } = params;
  
  const lines: string[] = [];
  
  if (includeHeaders) {
    lines.push('Product\tPrice\tQuantity\tTotal');
  }
  
  products.forEach(product => {
    const quantity = orderQuantities[product.id] || 0;
    if (quantity > 0) {
      const total = product.price * quantity;
      lines.push(`${product.name}\t${product.price}\t${quantity}\t${total}`);
    }
  });
  
  return lines.join('\n');
}
