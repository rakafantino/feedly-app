import { calculateExpiringItems } from '../stock-utils';
import { Product } from '@/types/product';
import { addDays, subDays } from 'date-fns';

describe('calculateExpiringItems', () => {
  it('should ignore deleted products', () => {
    const products: Product[] = [
      { id: '1', name: 'A', stock: 10, isDeleted: true, expiry_date: new Date() } as any
    ];
    const result = calculateExpiringItems(products);
    expect(result).toHaveLength(0);
  });

  it('should use batch data if available', () => {
    const futureDate = addDays(new Date(), 10);
    const products: Product[] = [
      {
        id: '1',
        name: 'Product A',
        stock: 10,
        purchase_price: 100,
        isDeleted: false,
        batches: [
          { id: 'b1', stock: 5, expiryDate: futureDate, batchNumber: 'B001', purchasePrice: 120 },
          { id: 'b2', stock: 0, expiryDate: futureDate, batchNumber: 'B002' }, // Ignored because stock <= 0
          { id: 'b3', stock: 5, batchNumber: 'B003' } // Ignored because no expiryDate
        ]
      } as any
    ];

    const result = calculateExpiringItems(products);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1-b1');
    expect(result[0].originalId).toBe('1');
    expect(result[0].batchId).toBe('b1');
    expect(result[0].stock).toBe(5);
    expect(result[0].batch_number).toBe('B001');
    expect(result[0].purchase_price).toBe(120);
    expect(result[0].isBatch).toBe(true);
    expect(result[0].daysLeft).toBeGreaterThanOrEqual(9);
    expect(result[0].daysLeft).toBeLessThanOrEqual(10);
  });

  it('should fallback to legacy expiry_date if no valid batches', () => {
    const pastDate = subDays(new Date(), 5);
    const products: Product[] = [
      {
        id: '2',
        name: 'Product B',
        stock: 20,
        expiry_date: pastDate,
        isDeleted: false,
        batches: []
      } as any
    ];

    const result = calculateExpiringItems(products);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
    expect(result[0].daysLeft).toBeGreaterThanOrEqual(-6);
    expect(result[0].daysLeft).toBeLessThanOrEqual(-4);
  });

  it('should ignore legacy product if stock is 0', () => {
    const products: Product[] = [
      {
        id: '3',
        name: 'Product C',
        stock: 0,
        expiry_date: new Date(),
        isDeleted: false
      } as any
    ];

    const result = calculateExpiringItems(products);
    expect(result).toHaveLength(0);
  });

  it('should sort items by daysLeft ascending', () => {
    const today = new Date();
    const products: Product[] = [
      { id: '1', stock: 10, expiry_date: addDays(today, 10), isDeleted: false } as any,
      { id: '2', stock: 10, expiry_date: addDays(today, 2), isDeleted: false } as any,
      { id: '3', stock: 10, expiry_date: subDays(today, 5), isDeleted: false } as any,
    ];

    const result = calculateExpiringItems(products);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('3'); // Expired (-5)
    expect(result[1].id).toBe('2'); // Near (2)
    expect(result[2].id).toBe('1'); // Far (10)
  });
});
