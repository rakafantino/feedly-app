import PurchaseOrderDetail from './components/PurchaseOrderDetail';

// Tipe params yang benar untuk Next.js 15
export default async function Page(props: { params: Promise<{ id: string }> }) {
  // Mendapatkan id dari params promise
  const { id } = await props.params;
  return <PurchaseOrderDetail id={id} />;
}
