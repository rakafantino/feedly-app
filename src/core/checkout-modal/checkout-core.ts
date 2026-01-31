// ============================================================================
// TYPES
// ============================================================================

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  [key: string]: unknown;
}

export interface Customer {
  id: string;
  name: string;
}

export interface PaymentMethod {
  method: string;
  amount: string;
}

export interface SplitPayment {
  method: string;
  amount: number;
}

export interface PaymentDetail {
  method: string;
  amount: number;
  cashGiven?: number;
  change?: number;
}

export interface CheckoutPayload {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: string;
  paymentDetails: PaymentDetail[] | null;
  customerId?: string;
  amountPaid: number;
  dueDate?: Date;
  discount: number;
}

export interface TransactionResult {
  items: CartItem[];
  payments: PaymentDetail[];
  customerName?: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  totalChange: number;
  discount: number;
  invoiceNumber: string;
}

export interface CheckoutState {
  cashAmount: string;
  paymentMethods: PaymentMethod[];
  discount: string;
  dueDate: string;
  isSplitPayment: boolean;
  selectedPaymentMethod: string;
}

export interface CalculationResult {
  grossTotal: number;
  discountValue: number;
  total: number;
  change: number;
  totalPayment: number;
  isDebt: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial checkout state
 * Pure function - no side effects
 */
export function createInitialCheckoutState(): CheckoutState {
  return {
    cashAmount: '',
    paymentMethods: [{ method: 'CASH', amount: '' }],
    discount: '',
    dueDate: '',
    isSplitPayment: false,
    selectedPaymentMethod: 'CASH'
  };
}

/**
 * Get default due date (7 days from now)
 * Pure function - no side effects
 */
export function getDefaultDueDate(): string {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.toISOString().split('T')[0];
}

// ============================================================================
// PARSING & FORMATTING
// ============================================================================

/**
 * Parse string input to number (remove non-numeric characters)
 * Pure function - no side effects
 */
export function parseInputToNumber(value: string): number {
  const numericValue = value.replace(/[^\d]/g, '');
  if (!numericValue) return 0;
  return parseInt(numericValue, 10);
}

/**
 * Format currency for display
 * Pure function - no side effects
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate all payment-related values
 * Pure function - no side effects
 */
export function calculateTotals(params: {
  items: CartItem[];
  discount: string;
  cashAmount: string;
  isSplitPayment: boolean;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethod: string;
}): CalculationResult {
  const { items, discount, cashAmount, isSplitPayment, paymentMethods, selectedPaymentMethod } = params;
  
  const grossTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountValue = parseInputToNumber(discount);
  const total = Math.max(0, grossTotal - discountValue);
  
  let change = 0;
  let totalPayment = 0;
  let isDebt = false;
  
  if (isSplitPayment) {
    totalPayment = paymentMethods.reduce((sum, p) => sum + parseInputToNumber(p.amount), 0);
    if (totalPayment < total) {
      isDebt = true;
    }
  } else {
    const cash = parseInputToNumber(cashAmount);
    totalPayment = cash;
    
    if (selectedPaymentMethod === 'DEBT') {
      isDebt = true;
    } else if (cash < total) {
      // Cash payment but insufficient - treated as error case in validation
      change = 0;
    } else {
      change = Math.max(0, cash - total);
    }
  }
  
  return {
    grossTotal,
    discountValue,
    total,
    change,
    totalPayment,
    isDebt
  };
}

/**
 * Calculate total payment from split methods
 * Pure function - no side effects
 */
export function calculateTotalPayment(paymentMethods: PaymentMethod[]): number {
  return paymentMethods.reduce((sum, p) => sum + parseInputToNumber(p.amount), 0);
}

/**
 * Calculate change for single payment
 * Pure function - no side effects
 */
export function calculateChange(cashAmount: string, total: number): number {
  const cash = parseInputToNumber(cashAmount);
  return Math.max(0, cash - total);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate checkout before submission
 * Pure function - no side effects
 */
export function validateCheckout(params: {
  items: CartItem[];
  total: number;
  isSplitPayment: boolean;
  cashAmount: string;
  selectedPaymentMethod: string;
  paymentMethods: PaymentMethod[];
  totalPayment: number;
  change: number;
  customer?: Customer | null;
  dueDate: string;
}): ValidationResult {
  const { items, total, isSplitPayment, cashAmount, selectedPaymentMethod, paymentMethods, totalPayment, customer, dueDate } = params;
  
  // Check if cart is empty
  if (items.length === 0) {
    return { valid: false, error: 'Keranjang kosong' };
  }
  
  // Check total
  if (total <= 0) {
    return { valid: false, error: 'Total tidak valid' };
  }
  
  if (isSplitPayment) {
    // For split payment, check if payment methods have valid amounts
    for (const method of paymentMethods) {
      const amount = parseInputToNumber(method.amount);
      if (amount < 0) {
        return { valid: false, error: 'Jumlah pembayaran tidak valid' };
      }
    }
    
    if (totalPayment < total) {
      // Partial payment = debt, need customer and due date
      if (!customer) {
        return { valid: false, error: 'Pilih pelanggan untuk mencatat hutang' };
      }
      if (!dueDate) {
        return { valid: false, error: 'Tentukan tanggal jatuh tempo' };
      }
    }
  } else {
    // Single payment
    if (selectedPaymentMethod === 'CASH') {
      const cash = parseInputToNumber(cashAmount);
      if (cash < total) {
        return { valid: false, error: `Pembayaran kurang ${formatCurrency(total - cash)}` };
      }
    } else if (selectedPaymentMethod === 'DEBT') {
      // Debt requires customer and due date
      if (!customer) {
        return { valid: false, error: 'Pilih pelanggan untuk mencatat hutang' };
      }
      if (!dueDate) {
        return { valid: false, error: 'Tentukan tanggal jatuh tempo' };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Check if transaction is a debt transaction
 * Pure function - no side effects
 */
export function isDebtTransaction(params: {
  total: number;
  isSplitPayment: boolean;
  selectedPaymentMethod: string;
  totalPayment: number;
}): boolean {
  const { total, isSplitPayment, selectedPaymentMethod, totalPayment } = params;
  
  if (isSplitPayment) {
    return totalPayment < total;
  }
  
  return selectedPaymentMethod === 'DEBT';
}

/**
 * Validate payment amount
 * Pure function - no side effects
 */
export function validatePaymentAmount(amount: string, max?: number): ValidationResult {
  // Check for negative sign in raw input
  if (amount.includes('-')) {
    return { valid: false, error: 'Jumlah tidak boleh negatif' };
  }
  
  const value = parseInputToNumber(amount);
  
  if (max !== undefined && value > max) {
    return { valid: false, error: `Jumlah tidak boleh melebihi ${formatCurrency(max)}` };
  }
  
  return { valid: true };
}

/**
 * Validate discount amount
 * Pure function - no side effects
 */
export function validateDiscount(discount: string, grossTotal: number): ValidationResult {
  // Check for negative sign in raw input
  if (discount.includes('-')) {
    return { valid: false, error: 'Diskon tidak boleh negatif' };
  }
  
  const value = parseInputToNumber(discount);
  
  if (value > grossTotal) {
    return { valid: false, error: 'Diskon tidak boleh melebihi total' };
  }
  
  return { valid: true };
}

/**
 * Validate due date
 * Pure function - no side effects
 */
export function validateDueDate(dueDate: string): ValidationResult {
  if (!dueDate) {
    return { valid: false, error: 'Tanggal jatuh tempo diperlukan' };
  }
  
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date < today) {
    return { valid: false, error: 'Tanggal jatuh tempo tidak boleh di masa lalu' };
  }
  
  return { valid: true };
}

// ============================================================================
// PAYMENT METHOD MANAGEMENT
// ============================================================================

/**
 * Add a new payment method to split payment
 * Pure function - no side effects
 */
export function addPaymentMethod(currentMethods: PaymentMethod[]): PaymentMethod[] {
  return [...currentMethods, { method: 'CASH', amount: '' }];
}

/**
 * Remove a payment method from split payment
 * Pure function - no side effects
 */
export function removePaymentMethod(currentMethods: PaymentMethod[], index: number): PaymentMethod[] {
  if (currentMethods.length <= 1) return currentMethods;
  return currentMethods.filter((_, i) => i !== index);
}

/**
 * Update payment method at index
 * Pure function - no side effects
 */
export function updatePaymentMethod(currentMethods: PaymentMethod[], index: number, method: string): PaymentMethod[] {
  const newMethods = [...currentMethods];
  if (newMethods[index]) {
    newMethods[index].method = method;
  }
  return newMethods;
}

/**
 * Update payment amount at index
 * Pure function - no side effects
 */
export function updatePaymentAmount(currentMethods: PaymentMethod[], index: number, amount: string): PaymentMethod[] {
  const newMethods = [...currentMethods];
  if (newMethods[index]) {
    newMethods[index].amount = amount;
  }
  return newMethods;
}

/**
 * Reset payment methods to default
 * Pure function - no side effects
 */
export function resetPaymentMethods(): PaymentMethod[] {
  return [{ method: 'CASH', amount: '' }];
}

// ============================================================================
// PAYLOAD CONSTRUCTION
// ============================================================================

/**
 * Build checkout payload for API
 * Pure function - no side effects
 */
export function buildCheckoutPayload(params: {
  items: CartItem[];
  paymentMethod: string;
  paymentDetails: PaymentDetail[] | null;
  customer?: Customer | null;
  amountPaid: number;
  dueDate?: string;
  discount: number;
  isDebt: boolean;
  cashAmount: string;
  change: number;
  total: number;
}): CheckoutPayload {
  const { items, paymentMethod, paymentDetails, customer, amountPaid, dueDate, discount, isDebt, cashAmount, change } = params;
  
  let finalPaymentDetails = paymentDetails;
  let finalAmountPaid = amountPaid;
  
  if (paymentMethod === 'SPLIT' && paymentDetails) {
    // Already formatted in caller
    finalPaymentDetails = paymentDetails;
  } else {
    const cashNumeric = parseInputToNumber(cashAmount);
    finalPaymentDetails = [
      {
        method: paymentMethod,
        amount: paymentMethod === 'DEBT' ? 0 : params.total,
        cashGiven: cashNumeric,
        change: change
      }
    ];
    finalAmountPaid = paymentMethod === 'DEBT' ? 0 : amountPaid;
  }
  
  return {
    items: items.map(item => ({
      productId: item.id,
      quantity: item.quantity,
      price: item.price
    })),
    paymentMethod,
    paymentDetails: finalPaymentDetails,
    customerId: customer?.id,
    amountPaid: finalAmountPaid,
    dueDate: isDebt || (paymentMethod !== 'DEBT' && amountPaid < params.total) 
      ? dueDate ? new Date(dueDate) : undefined 
      : undefined,
    discount
  };
}

/**
 * Prepare payment details for split payment
 * Pure function - no side effects
 */
export function prepareSplitPaymentDetails(paymentMethods: PaymentMethod[]): SplitPayment[] {
  return paymentMethods.map(method => ({
    method: method.method,
    amount: parseInputToNumber(method.amount)
  }));
}

/**
 * Prepare single payment details
 * Pure function - no side effects
 */
export function prepareSinglePaymentDetails(params: {
  method: string;
  total: number;
  cashAmount: string;
  change: number;
}): PaymentDetail[] {
  const { method, total, cashAmount, change } = params;
  const cashNumeric = parseInputToNumber(cashAmount);
  
  return [
    {
      method,
      amount: method === 'DEBT' ? 0 : total,
      cashGiven: cashNumeric,
      change: change
    }
  ];
}

// ============================================================================
// TRANSACTION RESULT
// ============================================================================

/**
 * Build transaction result for receipt
 * Pure function - no side effects
 */
export function buildTransactionResult(params: {
  items: CartItem[];
  payments: PaymentDetail[];
  customer?: Customer | null;
  storeInfo: {
    name: string;
    address: string;
    phone: string;
  };
  totalChange: number;
  discount: number;
  invoiceNumber: string;
}): TransactionResult {
  const { items, payments, customer, storeInfo, totalChange, discount, invoiceNumber } = params;
  
  return {
    items,
    payments,
    customerName: customer?.name,
    storeName: storeInfo.name,
    storeAddress: storeInfo.address,
    storePhone: storeInfo.phone,
    totalChange,
    discount,
    invoiceNumber
  };
}

/**
 * Get payment method display name
 * Pure function - no side effects
 */
export function getPaymentMethodName(method: string): string {
  const names: Record<string, string> = {
    'CASH': 'Tunai',
    'DEBT': 'Hutang',
    'TRANSFER': 'Transfer',
    'QRIS': 'QRIS',
    'CARD': 'Kartu',
    'SPLIT': 'Split'
  };
  return names[method] || method;
}

/**
 * Calculate remaining payment needed
 * Pure function - no side effects
 */
export function calculateRemainingPayment(total: number, totalPaid: number): number {
  return Math.max(0, total - totalPaid);
}

// ============================================================================
// RECEIPT FORMATTING
// ============================================================================

/**
 * Format date for receipt
 * Pure function - no side effects
 */
export function formatDateForReceipt(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date for filename
 * Pure function - no side effects
 */
export function formatDateForFilename(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Generate receipt filename
 * Pure function - no side effects
 */
export function generateReceiptFilename(invoiceNumber: string): string {
  return `Receipt-${invoiceNumber}.pdf`;
}

/**
 * Get current datetime for receipt
 * Pure function - no side effects
 */
export function getCurrentDateTimeForReceipt(): string {
  const now = new Date();
  return now.toISOString();
}

// ============================================================================
// DISCOUNT HELPERS
// ============================================================================

/**
 * Calculate discounted total
 * Pure function - no side effects
 */
export function applyDiscount(grossTotal: number, discountValue: number): number {
  return Math.max(0, grossTotal - discountValue);
}

/**
 * Check if discount is applied
 * Pure function - no side effects
 */
export function hasDiscount(discount: string): boolean {
  return parseInputToNumber(discount) > 0;
}

/**
 * Get discount display text
 * Pure function - no side effects
 */
export function getDiscountText(grossTotal: number, discountValue: number): string {
  if (discountValue <= 0) return '';
  return `Termasuk Diskon: ${formatCurrency(discountValue)}`;
}

// ============================================================================
// CART HELPERS
// ============================================================================

/**
 * Check if cart is empty
 * Pure function - no side effects
 */
export function isCartEmpty(items: CartItem[]): boolean {
  return items.length === 0;
}

/**
 * Get cart item count
 * Pure function - no side effects
 */
export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Calculate cart subtotal
 * Pure function - no side effects
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Format cart summary for display
 * Pure function - no side effects
 */
export function formatCartSummary(items: CartItem[]): Array<{ name: string; quantity: number; total: number }> {
  return items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    total: item.price * item.quantity
  }));
}
