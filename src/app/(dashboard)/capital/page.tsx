import { CapitalClient } from "./components/CapitalClient";

export default function CapitalPage() {
    return (
        <div className="flex-col">
            <div className="flex-1 space-y-4 pt-6">
                <CapitalClient />
            </div>
        </div>
    );
}
