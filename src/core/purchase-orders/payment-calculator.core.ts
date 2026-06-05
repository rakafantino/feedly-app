export interface PaymentCalculationInput {
  newTotalAmount: number;
  previousAmountPaid: number;
}

export interface PaymentCalculationResult {
  remainingDebt: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
}

export function calculatePurchaseOrderPaymentStatus(input: PaymentCalculationInput): PaymentCalculationResult {
  const remainingDebt = input.newTotalAmount - input.previousAmountPaid;
  
  let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
  
  if (remainingDebt <= 0) {
    paymentStatus = 'paid';
  } else if (remainingDebt < input.newTotalAmount) {
    paymentStatus = 'partial';
  }
  
  return {
    remainingDebt: Math.max(0, remainingDebt), // Ensure we don't return negative debt
    paymentStatus
  };
}
