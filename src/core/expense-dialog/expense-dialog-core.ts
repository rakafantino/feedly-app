// Expense Dialog Core
// Pure functions for expense form

export interface Expense {
    id: string;
    amount: number;
    description: string;
    category: string;
    date: string;
    createdAt: string;
}

export interface ExpenseFormData {
    amount: number;
    description: string;
    category: string;
    date: string;
}

export interface ExpenseDialogState {
    amount: string;
    description: string;
    category: string;
    date: string;
    isValid: boolean;
}

export function createInitialState(): ExpenseDialogState {
    return { amount: '', description: '', category: '', date: '', isValid: false };
}

export function createFromExpense(expense: Expense): ExpenseDialogState {
    return {
        amount: expense.amount.toString(),
        description: expense.description,
        category: expense.category,
        date: expense.date,
        isValid: true
    };
}

export function setAmount(current: ExpenseDialogState, amount: string): ExpenseDialogState {
    return { ...current, amount };
}

export function setDescription(current: ExpenseDialogState, description: string): ExpenseDialogState {
    return { ...current, description };
}

export function setCategory(current: ExpenseDialogState, category: string): ExpenseDialogState {
    return { ...current, category };
}

export function setDate(current: ExpenseDialogState, date: string): ExpenseDialogState {
    return { ...current, date };
}

export function validateForm(data: Omit<ExpenseDialogState, 'isValid'>): ExpenseDialogState {
    const amount = parseFloat(data.amount);
    const isValid = !isNaN(amount) && amount > 0 && data.description.trim().length > 0 && data.category.length > 0;
    return { ...data, isValid };
}

export function resetState(): ExpenseDialogState {
    return createInitialState();
}

export function formatAmount(value: string): string {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('id-ID').format(num);
}

export function getDialogTitle(isEdit: boolean): string {
    return isEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran';
}
