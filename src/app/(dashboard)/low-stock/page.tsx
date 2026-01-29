import { Suspense } from 'react';
import LowStockContent from './LowStockContent';

export const dynamic = 'force-dynamic';

export default function LowStockPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading stock data...</div>}>
      <LowStockContent />
    </Suspense>
  );
}