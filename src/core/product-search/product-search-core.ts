// Product Search Core
// Pure functions for product search

export interface ProductSearchState {
    query: string;
    results: string[];
    isSearching: boolean;
}

export function createInitialState(): ProductSearchState {
    return { query: '', results: [], isSearching: false };
}

export function setQuery(current: ProductSearchState, query: string): ProductSearchState {
    return { ...current, query };
}

export function setResults(current: ProductSearchState, results: string[]): ProductSearchState {
    return { ...current, results };
}

export function setSearching(current: ProductSearchState, isSearching: boolean): ProductSearchState {
    return { ...current, isSearching };
}

export function clearSearch(current: ProductSearchState): ProductSearchState {
    return { ...current, query: '', results: [] };
}

export function resetState(): ProductSearchState {
    return createInitialState();
}

export function formatSearchResultLabel(barcode: string, name: string): string {
    return `${barcode} - ${name}`;
}

export function hasQuery(state: ProductSearchState): boolean {
    return state.query.trim().length > 0;
}

export function hasResults(state: ProductSearchState): boolean {
    return state.results.length > 0;
}
