import { createInitialState, setSearchTerm, setSelectedCustomer, setOpen, toggleOpen, resetState, formatCustomerLabel, isCustomerSelected } from '../customer-selector-core';

describe('customer-selector-core', () => {
    it('createInitialState', () => {
        const state = createInitialState();
        expect(state.searchTerm).toBe('');
        expect(state.isOpen).toBe(false);
    });
    
    it('setSearchTerm', () => {
        const state = createInitialState();
        expect(setSearchTerm(state, 'John').searchTerm).toBe('John');
    });
    
    it('setSelectedCustomer', () => {
        const state = createInitialState();
        expect(setSelectedCustomer(state, '123').selectedCustomerId).toBe('123');
    });
    
    it('setOpen', () => {
        const state = createInitialState();
        expect(setOpen(state, true).isOpen).toBe(true);
    });
    
    it('toggleOpen', () => {
        const state = createInitialState();
        expect(toggleOpen(state).isOpen).toBe(true);
    });
    
    it('formatCustomerLabel', () => {
        expect(formatCustomerLabel('John', '0812')).toBe('John (0812)');
        expect(formatCustomerLabel('John')).toBe('John');
    });
    
    it('isCustomerSelected', () => {
        const state = { selectedCustomerId: '123' } as any;
        expect(isCustomerSelected(state, '123')).toBe(true);
        expect(isCustomerSelected(state, '456')).toBe(false);
    });
});
