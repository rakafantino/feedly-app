// ============================================================================
// TYPES
// ============================================================================

export interface CategoryItem {
    id: string;
    name: string;
    count?: number;
}

export interface CategoryFilterProps {
    categories: CategoryItem[];
    selectedCategory?: string;
    onCategorySelect: (categoryId?: string) => void;
    allLabel?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_ALL_LABEL = 'Semua';
export const NO_CATEGORY_LABEL = 'Tanpa Kategori';

// ============================================================================
// INITIALIZATION
// ============================================================================

export function createEmptyCategories(): CategoryItem[] {
    return [];
}

export function createDefaultAllCategory(): CategoryItem {
    return { id: 'all', name: DEFAULT_ALL_LABEL };
}

// ============================================================================
// FILTERING
// ============================================================================

export function filterCategories(categories: CategoryItem[], searchTerm: string): CategoryItem[] {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(term));
}

export function sortCategories(categories: CategoryItem[], direction: 'asc' | 'desc' = 'asc'): CategoryItem[] {
    return [...categories].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return direction === 'asc' ? comparison : -comparison;
    });
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateCategoryId(categories: CategoryItem[], categoryId: string): boolean {
    if (categoryId === 'all') return true;
    return categories.some(c => c.id === categoryId);
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatCategoryCount(count?: number): string {
    if (count === undefined || count === null) return '';
    return `(${count})`;
}

export function getCategoryDisplay(category: CategoryItem, includeCount: boolean = true): string {
    const countStr = includeCount ? formatCategoryCount(category.count) : '';
    return `${category.name}${countStr}`;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export function selectCategory(current: string | undefined, categoryId: string): string | undefined {
    if (categoryId === 'all') return undefined;
    return categoryId;
}

export function deselectCategory(current: string | undefined): string | undefined {
    return undefined;
}

export function toggleCategory(current: string | undefined, categoryId: string): string | undefined {
    return current === categoryId ? undefined : categoryId;
}

// ============================================================================
// SUMMARY
// ============================================================================

export function getCategorySummary(categories: CategoryItem[]): string {
    const total = categories.length;
    const totalProducts = categories.reduce((sum, c) => sum + (c.count || 0), 0);
    return `${total} kategori | ${totalProducts} produk`;
}

// ============================================================================
// EXPORT
// ============================================================================

export function prepareCategoriesExport(categories: CategoryItem[]): Array<Record<string, string>> {
    return categories.map(c => ({
        'Nama': c.name,
        'Jumlah': String(c.count || 0)
    }));
}
