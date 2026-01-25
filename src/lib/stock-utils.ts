import { Product } from '@/types/product';
import { differenceInDays } from 'date-fns';

export interface ExpiryItem extends Product {
  daysLeft: number;
  isBatch?: boolean;
  originalId?: string;
  batch_number?: string | null;
  batchId?: string;
}

export function calculateExpiringItems(products: Product[]): ExpiryItem[] {
  const allItems: ExpiryItem[] = [];

    products.forEach(product => {
    if (product.isDeleted) return;

    // Strategy 1: Use Batches if available
    if (product.batches && product.batches.length > 0) {
        product.batches.forEach(batch => {
            if (batch.stock <= 0) return;
            // Skip if no expiry date on batch
            if (!batch.expiryDate) return;

            const expiryDate = new Date(batch.expiryDate as string | Date);
            const today = new Date();
            const daysLeft = differenceInDays(expiryDate, today);
            
            // Only include if within notification range OR already expired
            // Logic note: The UI usually wants ALL expiring items to sort list, 
            // but the counter specifically typically wants "at risk" items.
            // For general list generation, we return everything that HAS an expiry date.
            // Filtering by notificationDays happens at the consumption level (ui).

            allItems.push({
            ...product,
            id: `${product.id}-${batch.id}`, // Unique ID for table rendering
            originalId: product.id,
            batchId: batch.id, // Real Batch ID
            stock: batch.stock, // Override with batch stock
            expiry_date: expiryDate, // Override with batch expiry
            batch_number: batch.batchNumber, // Use batch number
            purchase_price: batch.purchasePrice || product.purchase_price, // Use batch cost if available
            daysLeft,
            isBatch: true
            });
        });
    } 
    // Strategy 2: Fallback to product legacy fields if no batches found (and stock > 0)
    else if (product.expiry_date && product.stock > 0) {
        const expiryDate = new Date(product.expiry_date);
        const today = new Date();
        const daysLeft = differenceInDays(expiryDate, today);
        allItems.push({
            ...product,
            daysLeft
        });
    }
    });

    return allItems.sort((a, b) => a.daysLeft - b.daysLeft);
}
