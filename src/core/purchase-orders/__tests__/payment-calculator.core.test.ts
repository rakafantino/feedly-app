import { calculatePurchaseOrderPaymentStatus } from '../payment-calculator.core';

describe('calculatePurchaseOrderPaymentStatus', () => {
  it('should return unpaid when no amount is paid', () => {
    const result = calculatePurchaseOrderPaymentStatus({ newTotalAmount: 1000, previousAmountPaid: 0 });
    expect(result.remainingDebt).toBe(1000);
    expect(result.paymentStatus).toBe('unpaid');
  });

  it('should return partial when some amount is paid', () => {
    const result = calculatePurchaseOrderPaymentStatus({ newTotalAmount: 1000, previousAmountPaid: 400 });
    expect(result.remainingDebt).toBe(600);
    expect(result.paymentStatus).toBe('partial');
  });

  it('should return paid when fully paid', () => {
    const result = calculatePurchaseOrderPaymentStatus({ newTotalAmount: 1000, previousAmountPaid: 1000 });
    expect(result.remainingDebt).toBe(0);
    expect(result.paymentStatus).toBe('paid');
  });

  it('should cap negative debt at 0', () => {
    const result = calculatePurchaseOrderPaymentStatus({ newTotalAmount: 1000, previousAmountPaid: 1200 });
    expect(result.remainingDebt).toBe(0);
    expect(result.paymentStatus).toBe('paid');
  });
});
