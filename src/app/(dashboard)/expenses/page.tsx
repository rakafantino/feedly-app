import { ExpenseClient } from "./components/ExpenseClient";

export default function ExpensesPage() {
    return (
        <div className="flex-col">
            <div className="flex-1 space-y-4 pt-6">
                <ExpenseClient />
            </div>
        </div>
    );
}
