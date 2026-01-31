import { createInitialState, setViewMode, setSortBy, toggleSortDirection, VIEW_MODE_LABELS, SORT_BY_LABELS } from '../product-grid-core';

describe('product-grid-core', () => {
    it('createInitialState', () => {
        const state = createInitialState();
        expect(state.viewMode).toBe('grid');
        expect(state.sortBy).toBe('name');
    });
    
    it('setViewMode', () => {
        const state = createInitialState();
        expect(setViewMode(state, 'list').viewMode).toBe('list');
    });
    
    it('setSortBy', () => {
        const state = createInitialState();
        expect(setSortBy(state, 'price').sortBy).toBe('price');
    });
    
    it('toggleSortDirection', () => {
        const state = createInitialState();
        expect(toggleSortDirection(state).sortDirection).toBe('desc');
    });
    
    it('VIEW_MODE_LABELS', () => {
        expect(VIEW_MODE_LABELS.grid).toBe('Grid');
        expect(VIEW_MODE_LABELS.list).toBe('List');
    });
    
    it('SORT_BY_LABELS', () => {
        expect(SORT_BY_LABELS.name).toBe('Nama');
        expect(SORT_BY_LABELS.price).toBe('Harga');
    });
});
