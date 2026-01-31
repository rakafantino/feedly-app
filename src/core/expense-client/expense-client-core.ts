// Expense Client Core
// Pure functions for expense management

export interface Expense {
    id: string;
    amount: number;
    description: string;
    category: string;
    date: string;
    createdAt: string;
}

export interface ExpenseClientState {
    isLoading: boolean;
    isDialogOpen: boolean;
    editingExpense?: Expense;
    selectedPeriod: string;
}

export function createInitialState(): ExpenseClientState {
    return { isLoading: false, isDialogOpen: false, selectedPeriod: 'month' };
}

export function setLoading(current: ExpenseClientState, isLoading: boolean): ExpenseClientState {
    return { ...current, isLoading };
}

export function setDialogOpen(current: ExpenseClientState, isOpen: boolean): ExpenseClientState {
    return { ...current, isDialogOpen: isOpen };
}

export function setEditingExpense(current: ExpenseClientState, expense?: Expense): ExpenseClientState {
    return { ...current, editingExpense: expense };
}

export function setSelectedPeriod(current: ExpenseClientState, period: string): ExpenseClientState {
    return { ...current, selectedPeriod: period };
}

export function openNewExpenseDialog(current: ExpenseClientState): ExpenseClientState {
    return { ...current, isDialogOpen: true, editingExpense: undefined };
}

export function openEditExpenseDialog(current: ExpenseClientState, expense: Expense): ExpenseClientState {
    return { ...current, isDialogOpen: true, editingExpense: expense };
}

export function closeDialog(current: ExpenseClientState): ExpenseClientState {
    return { ...current, isDialogOpen: false, editingExpense: undefined };
}

export function resetState(): ExpenseClientState {
    return createInitialState();
}

export function calculateTotalExpenses(expenses: Expense[]): number {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function getExpenseSummary(expenses: Expense[]): { total: number; count: number; average: number } {
    const total = calculateTotalExpenses(expenses);
    return { total, count: expenses.length, average: expenses.length > 0 ? total / expenses.length : 0 };
}
