import { createInitialState, setLoading, setDialogOpen, setEditingExpense, openNewExpenseDialog, calculateTotalExpenses, getExpenseSummary } from '../expense-client-core';

describe('expense-client-core', () => {
    it('createInitialState', () => {
        const state = createInitialState();
        expect(state.isLoading).toBe(false);
        expect(state.isDialogOpen).toBe(false);
    });
    
    it('setLoading', () => {
        const state = createInitialState();
        expect(setLoading(state, true).isLoading).toBe(true);
    });
    
    it('setDialogOpen', () => {
        const state = createInitialState();
        expect(setDialogOpen(state, true).isDialogOpen).toBe(true);
    });
    
    it('setEditingExpense', () => {
        const state = createInitialState();
        const expense = { id: '1', amount: 100, description: 'Test', category: 'Food', date: '2025-01-15', createdAt: '' };
        expect(setEditingExpense(state, expense).editingExpense).toEqual(expense);
    });
    
    it('openNewExpenseDialog', () => {
        const state = { isDialogOpen: true, editingExpense: { id: '1' } as any } as any;
        const result = openNewExpenseDialog(state);
        expect(result.isDialogOpen).toBe(true);
        expect(result.editingExpense).toBeUndefined();
    });
    
    it('calculateTotalExpenses', () => {
        const expenses = [
            { id: '1', amount: 100, description: '', category: '', date: '', createdAt: '' },
            { id: '2', amount: 200, description: '', category: '', date: '', createdAt: '' }
        ];
        expect(calculateTotalExpenses(expenses)).toBe(300);
    });
    
    it('getExpenseSummary', () => {
        const expenses = [
            { id: '1', amount: 100, description: '', category: '', date: '', createdAt: '' },
            { id: '2', amount: 200, description: '', category: '', date: '', createdAt: '' }
        ];
        const summary = getExpenseSummary(expenses);
        expect(summary.total).toBe(300);
        expect(summary.count).toBe(2);
        expect(summary.average).toBe(150);
    });
});
