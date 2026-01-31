import { createInitialState, createFromExpense, setAmount, setDescription, setCategory, setDate, validateForm, resetState, formatAmount, getDialogTitle } from '../expense-dialog-core';

describe('expense-dialog-core', () => {
    it('createInitialState', () => {
        const state = createInitialState();
        expect(state.amount).toBe('');
        expect(state.isValid).toBe(false);
    });
    
    it('createFromExpense', () => {
        const expense = { id: '1', amount: 100, description: 'Test', category: 'Food', date: '2025-01-15', createdAt: '' };
        const state = createFromExpense(expense);
        expect(state.amount).toBe('100');
        expect(state.isValid).toBe(true);
    });
    
    it('setAmount', () => {
        const state = createInitialState();
        expect(setAmount(state, '50000').amount).toBe('50000');
    });
    
    it('setDescription', () => {
        const state = createInitialState();
        expect(setDescription(state, 'Test expense').description).toBe('Test expense');
    });
    
    it('validateForm - valid', () => {
        const state = { amount: '100', description: 'Test', category: 'Food', date: '2025-01-15' };
        const result = validateForm(state);
        expect(result.isValid).toBe(true);
    });
    
    it('validateForm - invalid amount', () => {
        const state = { amount: '0', description: 'Test', category: 'Food', date: '2025-01-15' };
        const result = validateForm(state);
        expect(result.isValid).toBe(false);
    });
    
    it('formatAmount', () => {
        expect(formatAmount('50000')).toContain('50');
    });
    
    it('getDialogTitle', () => {
        expect(getDialogTitle(false)).toBe('Tambah Pengeluaran');
        expect(getDialogTitle(true)).toBe('Edit Pengeluaran');
    });
});
