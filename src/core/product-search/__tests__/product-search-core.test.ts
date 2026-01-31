import { createInitialState, setQuery, setResults, setSearching, clearSearch, formatSearchResultLabel, hasQuery, hasResults } from '../product-search-core';

describe('product-search-core', () => {
    it('createInitialState', () => {
        const state = createInitialState();
        expect(state.query).toBe('');
        expect(state.results).toEqual([]);
    });
    
    it('setQuery', () => {
        const state = createInitialState();
        expect(setQuery(state, '123').query).toBe('123');
    });
    
    it('setResults', () => {
        const state = createInitialState();
        expect(setResults(state, ['1', '2']).results).toEqual(['1', '2']);
    });
    
    it('setSearching', () => {
        const state = createInitialState();
        expect(setSearching(state, true).isSearching).toBe(true);
    });
    
    it('clearSearch', () => {
        const state = { query: 'test', results: ['1'] } as any;
        const result = clearSearch(state);
        expect(result.query).toBe('');
        expect(result.results).toEqual([]);
    });
    
    it('formatSearchResultLabel', () => {
        expect(formatSearchResultLabel('123', 'Product A')).toBe('123 - Product A');
    });
    
    it('hasQuery', () => {
        expect(hasQuery({ query: 'test' } as any)).toBe(true);
        expect(hasQuery({ query: '' } as any)).toBe(false);
    });
    
    it('hasResults', () => {
        expect(hasResults({ results: ['1'] } as any)).toBe(true);
        expect(hasResults({ results: [] } as any)).toBe(false);
    });
});
