/**
 * TDD Tests for checkout-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialCheckoutState,
  getDefaultDueDate,
  
  // Parsing & Formatting
  parseInputToNumber,
  formatCurrency,
  
  // Calculations
  calculateTotals,
  calculateTotalPayment,
  calculateChange,
  
  // Validation
  validateCheckout,
  isDebtTransaction,
  validatePaymentAmount,
  validateDiscount,
  validateDueDate,
  
  // Payment Method Management
  addPaymentMethod,
  removePaymentMethod,
  updatePaymentMethod,
  updatePaymentAmount,
  resetPaymentMethods,
  
  // Payload Construction
  buildCheckoutPayload,
  prepareSplitPaymentDetails,
  prepareSinglePaymentDetails,
  
  // Transaction Result
  buildTransactionResult,
  getPaymentMethodName,
  calculateRemainingPayment,
  
  // Receipt Formatting
  formatDateForReceipt,
  formatDateForFilename,
  generateReceiptFilename,
  getCurrentDateTimeForReceipt,
  
  // Discount Helpers
  applyDiscount,
  hasDiscount,
  getDiscountText,
  
  // Cart Helpers
  isCartEmpty,
  getCartItemCount,
  calculateCartSubtotal,
  formatCartSummary
} from '../checkout-core';
import { CartItem, PaymentMethod, Customer } from '../checkout-core';

// Mock helpers
const createMockCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 'item-1',
  name: 'Test Product',
  price: 10000,
  quantity: 2,
  ...overrides
});

const createMockCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'cust-1',
  name: 'Test Customer',
  ...overrides
});

describe('createInitialCheckoutState', () => {
  it('creates initial state', () => {
    const result = createInitialCheckoutState();
    expect(result.cashAmount).toBe('');
    expect(result.paymentMethods).toEqual([{ method: 'CASH', amount: '' }]);
    expect(result.discount).toBe('');
    expect(result.dueDate).toBe('');
    expect(result.isSplitPayment).toBe(false);
    expect(result.selectedPaymentMethod).toBe('CASH');
  });
});

describe('getDefaultDueDate', () => {
  it('returns date approximately 7 days from now', () => {
    const result = getDefaultDueDate();
    const date = new Date(result);
    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    
    // Allow for timezone differences (1 day buffer)
    const minDate = new Date(expected);
    minDate.setDate(minDate.getDate() - 1);
    const maxDate = new Date(expected);
    maxDate.setDate(maxDate.getDate() + 1);
    
    expect(date >= minDate && date <= maxDate).toBe(true);
  });
});

describe('parseInputToNumber', () => {
  describe('edge cases', () => {
    it('returns 0 for empty string', () => {
      expect(parseInputToNumber('')).toBe(0);
    });
    
    it('returns 0 for non-numeric', () => {
      expect(parseInputToNumber('abc')).toBe(0);
    });
    
    it('handles spaces and symbols', () => {
      expect(parseInputToNumber('Rp 10.000')).toBe(10000);
    });
  });
  
  describe('normal cases', () => {
    it('parses correctly', () => {
      expect(parseInputToNumber('10000')).toBe(10000);
      expect(parseInputToNumber('1,000,000')).toBe(1000000);
    });
  });
});

describe('formatCurrency', () => {
  it('formats correctly', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('1.000.000');
    expect(result).toContain('Rp');
  });
  
  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0');
  });
});

describe('calculateTotals', () => {
  const mockItems: CartItem[] = [
    createMockCartItem({ price: 10000, quantity: 2 }),
    createMockCartItem({ id: 'item-2', name: 'Item 2', price: 15000, quantity: 1 })
  ];
  
  it('calculates correctly with no discount', () => {
    const result = calculateTotals({
      items: mockItems,
      discount: '',
      cashAmount: '50000',
      isSplitPayment: false,
      paymentMethods: [],
      selectedPaymentMethod: 'CASH'
    });
    
    // (10000 * 2) + (15000 * 1) = 35000
    expect(result.grossTotal).toBe(35000);
    expect(result.discountValue).toBe(0);
    expect(result.total).toBe(35000);
    // cash - total = 50000 - 35000 = 15000
    expect(result.change).toBe(15000);
  });
  
  it('applies discount correctly', () => {
    const result = calculateTotals({
      items: mockItems,
      discount: '5000',
      cashAmount: '50000',
      isSplitPayment: false,
      paymentMethods: [],
      selectedPaymentMethod: 'CASH'
    });
    
    expect(result.grossTotal).toBe(35000);
    expect(result.discountValue).toBe(5000);
    expect(result.total).toBe(30000);
    expect(result.change).toBe(20000);
  });
  
  it('handles split payment debt', () => {
    const result = calculateTotals({
      items: mockItems,
      discount: '',
      cashAmount: '',
      isSplitPayment: true,
      paymentMethods: [{ method: 'CASH', amount: '20000' }, { method: 'TRANSFER', amount: '10000' }],
      selectedPaymentMethod: 'CASH'
    });
    
    // 35000 total, 30000 paid = 5000 debt
    expect(result.totalPayment).toBe(30000);
    expect(result.isDebt).toBe(true);
  });
  
  it('handles debt payment method', () => {
    const result = calculateTotals({
      items: mockItems,
      discount: '',
      cashAmount: '50000',
      isSplitPayment: false,
      paymentMethods: [],
      selectedPaymentMethod: 'DEBT'
    });
    
    expect(result.isDebt).toBe(true);
    expect(result.change).toBe(0);
  });
});

describe('calculateTotalPayment', () => {
  it('sums split payments correctly', () => {
    const methods: PaymentMethod[] = [
      { method: 'CASH', amount: '20000' },
      { method: 'TRANSFER', amount: '15000' }
    ];
    expect(calculateTotalPayment(methods)).toBe(35000);
  });
  
  it('handles empty amounts', () => {
    const methods: PaymentMethod[] = [
      { method: 'CASH', amount: '' }
    ];
    expect(calculateTotalPayment(methods)).toBe(0);
  });
});

describe('calculateChange', () => {
  it('calculates correct change', () => {
    expect(calculateChange('50000', 35000)).toBe(15000);
  });
  
  it('returns 0 for exact payment', () => {
    expect(calculateChange('35000', 35000)).toBe(0);
  });
  
  it('returns 0 for underpayment', () => {
    expect(calculateChange('20000', 35000)).toBe(0);
  });
});

describe('validateCheckout', () => {
  const mockItems = [createMockCartItem()];
  
  it('returns error for empty cart', () => {
    const result = validateCheckout({
      items: [],
      total: 35000,
      isSplitPayment: false,
      cashAmount: '50000',
      selectedPaymentMethod: 'CASH',
      paymentMethods: [],
      totalPayment: 50000,
      change: 15000,
      dueDate: ''
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Keranjang kosong');
  });
  
  it('returns error for insufficient cash', () => {
    const result = validateCheckout({
      items: mockItems,
      total: 20000,
      isSplitPayment: false,
      cashAmount: '10000',
      selectedPaymentMethod: 'CASH',
      paymentMethods: [],
      totalPayment: 10000,
      change: 0,
      dueDate: ''
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Pembayaran kurang');
  });
  
  it('returns error for debt without customer', () => {
    const result = validateCheckout({
      items: mockItems,
      total: 20000,
      isSplitPayment: false,
      cashAmount: '',
      selectedPaymentMethod: 'DEBT',
      paymentMethods: [],
      totalPayment: 0,
      change: 0,
      customer: null,
      dueDate: ''
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Pilih pelanggan');
  });
  
  it('returns error for debt without due date', () => {
    const result = validateCheckout({
      items: mockItems,
      total: 20000,
      isSplitPayment: false,
      cashAmount: '',
      selectedPaymentMethod: 'DEBT',
      paymentMethods: [],
      totalPayment: 0,
      change: 0,
      customer: createMockCustomer(),
      dueDate: ''
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Tentukan');
  });
  
  it('returns valid for complete debt', () => {
    const result = validateCheckout({
      items: mockItems,
      total: 20000,
      isSplitPayment: false,
      cashAmount: '',
      selectedPaymentMethod: 'DEBT',
      paymentMethods: [],
      totalPayment: 0,
      change: 0,
      customer: createMockCustomer(),
      dueDate: '2025-02-15'
    });
    expect(result.valid).toBe(true);
  });
  
  it('returns valid for sufficient cash', () => {
    const result = validateCheckout({
      items: mockItems,
      total: 20000,
      isSplitPayment: false,
      cashAmount: '50000',
      selectedPaymentMethod: 'CASH',
      paymentMethods: [],
      totalPayment: 50000,
      change: 30000,
      dueDate: ''
    });
    expect(result.valid).toBe(true);
  });
});

describe('isDebtTransaction', () => {
  it('returns true for DEBT payment method', () => {
    expect(isDebtTransaction({
      total: 35000,
      isSplitPayment: false,
      selectedPaymentMethod: 'DEBT',
      totalPayment: 0
    })).toBe(true);
  });
  
  it('returns true for split payment under total', () => {
    expect(isDebtTransaction({
      total: 35000,
      isSplitPayment: true,
      selectedPaymentMethod: 'CASH',
      totalPayment: 20000
    })).toBe(true);
  });
  
  it('returns false for full split payment', () => {
    expect(isDebtTransaction({
      total: 35000,
      isSplitPayment: true,
      selectedPaymentMethod: 'CASH',
      totalPayment: 35000
    })).toBe(false);
  });
});

describe('validatePaymentAmount', () => {
  it('returns error for negative', () => {
    const result = validatePaymentAmount('-1000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negatif');
  });
  
  it('returns error when exceeding max', () => {
    const result = validatePaymentAmount('50000', 30000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('melebihi');
  });
  
  it('returns valid for correct amount', () => {
    const result = validatePaymentAmount('25000', 30000);
    expect(result.valid).toBe(true);
  });
});

describe('validateDiscount', () => {
  it('returns error for negative discount', () => {
    const result = validateDiscount('-5000', 35000);
    expect(result.valid).toBe(false);
  });
  
  it('returns error when exceeding total', () => {
    const result = validateDiscount('50000', 35000);
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for correct discount', () => {
    const result = validateDiscount('5000', 35000);
    expect(result.valid).toBe(true);
  });
});

describe('validateDueDate', () => {
  it('returns error for empty date', () => {
    const result = validateDueDate('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('diperlukan');
  });
  
  it('returns error for past date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = validateDueDate(yesterday.toISOString().split('T')[0]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('masa lalu');
  });
  
  it('returns valid for future date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = validateDueDate(tomorrow.toISOString().split('T')[0]);
    expect(result.valid).toBe(true);
  });
});

describe('addPaymentMethod', () => {
  it('adds new method', () => {
    const result = addPaymentMethod([{ method: 'CASH', amount: '' }]);
    expect(result.length).toBe(2);
    expect(result[1].method).toBe('CASH');
  });
});

describe('removePaymentMethod', () => {
  it('removes method at index', () => {
    const methods = [
      { method: 'CASH', amount: '20000' },
      { method: 'TRANSFER', amount: '15000' }
    ];
    const result = removePaymentMethod(methods, 1);
    expect(result.length).toBe(1);
    expect(result[0].method).toBe('CASH');
  });
  
  it('returns same array if only one method', () => {
    const methods = [{ method: 'CASH', amount: '' }];
    const result = removePaymentMethod(methods, 0);
    expect(result.length).toBe(1);
  });
});

describe('updatePaymentMethod', () => {
  it('updates method at index', () => {
    const methods = [{ method: 'CASH', amount: '' }];
    const result = updatePaymentMethod(methods, 0, 'TRANSFER');
    expect(result[0].method).toBe('TRANSFER');
  });
});

describe('updatePaymentAmount', () => {
  it('updates amount at index', () => {
    const methods = [{ method: 'CASH', amount: '' }];
    const result = updatePaymentAmount(methods, 0, '50000');
    expect(result[0].amount).toBe('50000');
  });
});

describe('resetPaymentMethods', () => {
  it('resets to default', () => {
    const result = resetPaymentMethods();
    expect(result).toEqual([{ method: 'CASH', amount: '' }]);
  });
});

describe('buildCheckoutPayload', () => {
  const mockItems = [createMockCartItem()];
  
  it('builds split payment payload', () => {
    const result = buildCheckoutPayload({
      items: mockItems,
      paymentMethod: 'SPLIT',
      paymentDetails: [
        { method: 'CASH', amount: 20000 },
        { method: 'TRANSFER', amount: 15000 }
      ],
      amountPaid: 35000,
      discount: 0,
      isDebt: false,
      cashAmount: '',
      change: 0,
      total: 35000
    });
    
    expect(result.paymentMethod).toBe('SPLIT');
    expect(result.items.length).toBe(1);
    expect(result.discount).toBe(0);
  });
  
  it('builds debt payload with due date', () => {
    const result = buildCheckoutPayload({
      items: mockItems,
      paymentMethod: 'DEBT',
      paymentDetails: [{ method: 'DEBT', amount: 0 }],
      amountPaid: 0,
      customer: createMockCustomer(),
      dueDate: '2025-02-15',
      discount: 0,
      isDebt: true,
      cashAmount: '',
      change: 0,
      total: 20000
    });
    
    expect(result.paymentMethod).toBe('DEBT');
    expect(result.customerId).toBe('cust-1');
    expect(result.dueDate).toBeDefined();
  });
});

describe('prepareSplitPaymentDetails', () => {
  it('converts to numeric amounts', () => {
    const result = prepareSplitPaymentDetails([
      { method: 'CASH', amount: '20000' },
      { method: 'TRANSFER', amount: '15000' }
    ]);
    
    expect(result[0].amount).toBe(20000);
    expect(result[1].amount).toBe(15000);
  });
});

describe('prepareSinglePaymentDetails', () => {
  it('prepares cash payment details', () => {
    const result = prepareSinglePaymentDetails({
      method: 'CASH',
      total: 35000,
      cashAmount: '50000',
      change: 15000
    });
    
    expect(result[0].method).toBe('CASH');
    expect(result[0].amount).toBe(35000);
    expect(result[0].cashGiven).toBe(50000);
    expect(result[0].change).toBe(15000);
  });
  
  it('prepares debt payment details', () => {
    const result = prepareSinglePaymentDetails({
      method: 'DEBT',
      total: 35000,
      cashAmount: '',
      change: 0
    });
    
    expect(result[0].method).toBe('DEBT');
    expect(result[0].amount).toBe(0);
  });
});

describe('buildTransactionResult', () => {
  it('builds result with customer', () => {
    const result = buildTransactionResult({
      items: [createMockCartItem()],
      payments: [{ method: 'CASH', amount: 20000, cashGiven: 25000, change: 5000 }],
      customer: createMockCustomer(),
      storeInfo: {
        name: 'Test Store',
        address: 'Test Address',
        phone: '123456'
      },
      totalChange: 5000,
      discount: 0,
      invoiceNumber: 'INV-001'
    });
    
    expect(result.customerName).toBe('Test Customer');
    expect(result.storeName).toBe('Test Store');
    expect(result.invoiceNumber).toBe('INV-001');
  });
});

describe('getPaymentMethodName', () => {
  it('returns display names', () => {
    expect(getPaymentMethodName('CASH')).toBe('Tunai');
    expect(getPaymentMethodName('DEBT')).toBe('Hutang');
    expect(getPaymentMethodName('TRANSFER')).toBe('Transfer');
    expect(getPaymentMethodName('QRIS')).toBe('QRIS');
    expect(getPaymentMethodName('CARD')).toBe('Kartu');
    expect(getPaymentMethodName('SPLIT')).toBe('Split');
  });
  
  it('returns original for unknown method', () => {
    expect(getPaymentMethodName('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('calculateRemainingPayment', () => {
  it('calculates remaining correctly', () => {
    expect(calculateRemainingPayment(35000, 20000)).toBe(15000);
    expect(calculateRemainingPayment(35000, 35000)).toBe(0);
    expect(calculateRemainingPayment(35000, 50000)).toBe(0);
  });
});

describe('formatDateForReceipt', () => {
  it('formats date correctly', () => {
    const result = formatDateForReceipt('2025-01-15T10:30:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('Januari');
  });
});

describe('formatDateForFilename', () => {
  it('formats for filename', () => {
    const result = formatDateForFilename();
    // Should be YYYYMMDD-HHMMSS format
    expect(result).toMatch(/^\d{8}-\d{6}$/);
  });
});

describe('generateReceiptFilename', () => {
  it('generates correct filename', () => {
    const result = generateReceiptFilename('INV-001');
    expect(result).toBe('Receipt-INV-001.pdf');
  });
});

describe('getCurrentDateTimeForReceipt', () => {
  it('returns ISO string', () => {
    const result = getCurrentDateTimeForReceipt();
    expect(result).toContain('T');
    expect(result).toContain('Z');
  });
});

describe('applyDiscount', () => {
  it('applies discount correctly', () => {
    expect(applyDiscount(35000, 5000)).toBe(30000);
  });
  
  it('returns 0 for discount exceeding total', () => {
    expect(applyDiscount(35000, 50000)).toBe(0);
  });
});

describe('hasDiscount', () => {
  it('returns true for non-zero discount', () => {
    expect(hasDiscount('5000')).toBe(true);
  });
  
  it('returns false for empty or zero', () => {
    expect(hasDiscount('')).toBe(false);
    expect(hasDiscount('0')).toBe(false);
  });
});

describe('getDiscountText', () => {
  it('returns empty for no discount', () => {
    expect(getDiscountText(35000, 0)).toBe('');
  });
  
  it('returns formatted text for discount', () => {
    const result = getDiscountText(35000, 5000);
    expect(result).toContain('Diskon');
    expect(result).toContain('5.000');
  });
});

describe('isCartEmpty', () => {
  it('returns true for empty array', () => {
    expect(isCartEmpty([])).toBe(true);
  });
  
  it('returns false for items', () => {
    expect(isCartEmpty([createMockCartItem()])).toBe(false);
  });
});

describe('getCartItemCount', () => {
  it('sums quantities', () => {
    const items = [
      createMockCartItem({ quantity: 2 }),
      createMockCartItem({ id: 'item-2', quantity: 3 })
    ];
    expect(getCartItemCount(items)).toBe(5);
  });
});

describe('calculateCartSubtotal', () => {
  it('calculates correctly', () => {
    const items = [
      createMockCartItem({ price: 10000, quantity: 2 }),
      createMockCartItem({ id: 'item-2', price: 15000, quantity: 1 })
    ];
    expect(calculateCartSubtotal(items)).toBe(35000);
  });
});

describe('formatCartSummary', () => {
  it('formats correctly', () => {
    const items = [
      createMockCartItem({ price: 10000, quantity: 2 })
    ];
    const result = formatCartSummary(items);
    expect(result[0].name).toBe('Test Product');
    expect(result[0].quantity).toBe(2);
    expect(result[0].total).toBe(20000);
  });
});
