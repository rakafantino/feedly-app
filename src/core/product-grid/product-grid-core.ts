// Product Grid Core
// Pure functions for product grid display

export interface ProductGridState {
    viewMode: 'grid' | 'list';
    sortBy: 'name' | 'price' | 'stock';
    sortDirection: 'asc' | 'desc';
}

export function createInitialState(): ProductGridState {
    return { viewMode: 'grid', sortBy: 'name', sortDirection: 'asc' };
}

export function setViewMode(current: ProductGridState, mode: 'grid' | 'list'): ProductGridState {
    return { ...current, viewMode: mode };
}

export function setSortBy(current: ProductGridState, sortBy: 'name' | 'price' | 'stock'): ProductGridState {
    return { ...current, sortBy };
}

export function toggleSortDirection(current: ProductGridState): ProductGridState {
    return { ...current, sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc' };
}

export function resetState(): ProductGridState {
    return createInitialState();
}

export const VIEW_MODE_LABELS = {
    grid: 'Grid',
    list: 'List'
};

export const SORT_BY_LABELS = {
    name: 'Nama',
    price: 'Harga',
    stock: 'Stok'
};
