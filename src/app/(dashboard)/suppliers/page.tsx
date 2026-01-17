import { SupplierClient } from "./components/SupplierClient";

export default function SuppliersPage() {
    return (
        <div className="flex-col">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <SupplierClient />
            </div>
        </div>
    );
}
