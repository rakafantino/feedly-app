import { Suspense } from 'react';
import { PageSkeleton } from '@/components/skeleton';
import LowStockContent from './LowStockContent';

export const dynamic = 'force-dynamic';

export default function LowStockPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LowStockContent />
    </Suspense>
  );
}