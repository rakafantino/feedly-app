// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    updatedAt?: string;
    createdAt?: string;
    isDeleted?: boolean;
}

export interface SupplierState {
    open: boolean;
    editingSupplier: Supplier | undefined;
    deleteOpen: boolean;
    supplierToDelete: Supplier | undefined;
    deleteLoading: boolean;
}

export interface SupplierApiResponse {
    success: boolean;
    data?: Supplier | Supplier[];
    error?: string;
}

export interface SupplierContact {
    email: string | null;
    phone: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const QUERY_KEYS = ['suppliers'] as const;

export const API_ENDPOINTS = {
    LIST: '/api/suppliers',
    GET: (id: string) => `/api/suppliers/${id}`,
    DELETE: (id: string) => `/api/suppliers/${id}`
} as const;

export const DEFAULT_PAGE_SIZE = 10;

export const SEARCH_KEY = 'name';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial state
 * Pure function - no side effects
 */
export function createInitialState(): SupplierState {
    return {
        open: false,
        editingSupplier: undefined,
        deleteOpen: false,
        supplierToDelete: undefined,
        deleteLoading: false
    };
}

/**
 * Create empty supplier
 * Pure function - no side effects
 */
export function createEmptySupplier(): Supplier {
    return {
        id: '',
        name: '',
        code: null,
        email: null,
        phone: null,
        address: null
    };
}

/**
 * Create empty state for dialog
 * Pure function - no side effects
 */
export function createEmptyDialogState(): { open: boolean; editingSupplier: Supplier | undefined } {
    return {
        open: false,
        editingSupplier: undefined
    };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set dialog open state
 * Pure function - no side effects
 */
export function setDialogOpen(current: SupplierState, open: boolean): SupplierState {
    return { ...current, open };
}

/**
 * Set editing supplier
 * Pure function - no side effects
 */
export function setEditingSupplier(current: SupplierState, supplier: Supplier | undefined): SupplierState {
    return { ...current, editingSupplier: supplier };
}

/**
 * Open dialog for new supplier
 * Pure function - no side effects
 */
export function openNewSupplierDialog(current: SupplierState): SupplierState {
    return {
        ...current,
        open: true,
        editingSupplier: undefined
    };
}

/**
 * Open dialog for edit
 * Pure function - no side effects
 */
export function openEditDialog(current: SupplierState, supplier: Supplier): SupplierState {
    return {
        ...current,
        open: true,
        editingSupplier: supplier
    };
}

/**
 * Close dialog
 * Pure function - no side effects
 */
export function closeDialog(current: SupplierState): SupplierState {
    return {
        ...current,
        open: false,
        editingSupplier: undefined
    };
}

/**
 * Set delete confirmation open
 * Pure function - no side effects
 */
export function setDeleteOpen(current: SupplierState, deleteOpen: boolean): SupplierState {
    return { ...current, deleteOpen };
}

/**
 * Set supplier to delete
 * Pure function - no side effects
 */
export function setSupplierToDelete(current: SupplierState, supplier: Supplier | undefined): SupplierState {
    return { ...current, supplierToDelete: supplier };
}

/**
 * Open delete confirmation
 * Pure function - no side effects
 */
export function openDeleteConfirmation(current: SupplierState, supplier: Supplier): SupplierState {
    return {
        ...current,
        deleteOpen: true,
        supplierToDelete: supplier
    };
}

/**
 * Close delete confirmation
 * Pure function - no side effects
 */
export function closeDeleteConfirmation(current: SupplierState): SupplierState {
    return {
        ...current,
        deleteOpen: false,
        supplierToDelete: undefined
    };
}

/**
 * Set delete loading
 * Pure function - no side effects
 */
export function setDeleteLoading(current: SupplierState, loading: boolean): SupplierState {
    return { ...current, deleteLoading: loading };
}

/**
 * Reset all state
 * Pure function - no side effects
 */
export function resetState(): SupplierState {
    return createInitialState();
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Build list URL
 * Pure function - no side effects
 */
export function buildListUrl(): string {
    return API_ENDPOINTS.LIST;
}

/**
 * Build delete URL
 * Pure function - no side effects
 */
export function buildDeleteUrl(id: string): string {
    return API_ENDPOINTS.DELETE(id);
}

/**
 * Check if delete was successful
 * Pure function - no side effects
 */
export function isDeleteSuccess(response: SupplierApiResponse): boolean {
    return response.success === true;
}

/**
 * Parse supplier list from response
 * Pure function - no side effects
 */
export function parseSupplierList(json: unknown): Supplier[] {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    const response = json as { suppliers?: Supplier[] };
    return response.suppliers || [];
}

/**
 * Get error message from response
 * Pure function - no side effects
 */
export function getErrorMessage(response: SupplierApiResponse): string {
    return response.error || 'Terjadi kesalahan';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate supplier for delete
 * Pure function - no side effects
 */
export function validateDelete(supplier: Supplier | undefined): { valid: boolean; error?: string } {
    if (!supplier) {
        return { valid: false, error: 'Supplier tidak ditemukan' };
    }
    if (!supplier.id) {
        return { valid: false, error: 'ID supplier tidak valid' };
    }
    return { valid: true };
}

/**
 * Check if can delete
 * Pure function - no side effects
 */
export function canDelete(supplier: Supplier | undefined): boolean {
    return validateDelete(supplier).valid;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format supplier for display
 * Pure function - no side effects
 */
export function formatSupplierDisplay(supplier: Supplier): Record<string, string> {
    return {
        'Nama': supplier.name || '-',
        'Email': supplier.email || '-',
        'Telepon': supplier.phone || '-',
        'Alamat': supplier.address || '-',
        'Terakhir Diubah': supplier.updatedAt ? new Date(supplier.updatedAt).toLocaleDateString('id-ID') : '-'
    };
}

/**
 * Get supplier summary
 * Pure function - no side effects
 */
export function getSupplierSummary(suppliers: Supplier[]): string {
    const total = suppliers.length;
    const active = suppliers.filter(s => !s.isDeleted).length;
    const withEmail = suppliers.filter(s => s.email).length;
    const withPhone = suppliers.filter(s => s.phone).length;
    
    return `Total: ${total} | Aktif: ${active} | Ada Email: ${withEmail} | Ada Telepon: ${withPhone}`;
}

/**
 * Format contact for display
 * Pure function - no side effects
 */
export function formatContact(contact: SupplierContact): { email: string; phone: string } {
    return {
        email: contact.email || '-',
        phone: contact.phone || '-'
    };
}

/**
 * Format email for display
 * Pure function - no side effects
 */
export function formatEmail(email: string | null | undefined): string {
    return email || '-';
}

/**
 * Format phone for display
 * Pure function - no side effects
 */
export function formatSupplierPhone(phone: string | null | undefined): string {
    return phone || '-';
}

/**
 * Format address for display
 * Pure function - no side effects
 */
export function formatSupplierAddress(address: string | null | undefined): string {
    return address || '-';
}

/**
 * Get contact display
 * Pure function - no side effects
 */
export function getContactDisplay(email: string | null | undefined, phone: string | null | undefined): { email: string; phone: string } {
    return {
        email: formatEmail(email),
        phone: formatSupplierPhone(phone)
    };
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if supplier changed
 * Pure function - no side effects
 */
export function hasSupplierChanged(original: Supplier, updated: Partial<Supplier>): boolean {
    return (
        original.name !== (updated.name || original.name) ||
        (original.email || '') !== (updated.email || original.email || '') ||
        (original.phone || '') !== (updated.phone || original.phone || '') ||
        (original.address || '') !== (updated.address || original.address || '')
    );
}

/**
 * Find supplier by ID
 * Pure function - no side effects
 */
export function findSupplierById(suppliers: Supplier[], id: string): Supplier | undefined {
    return suppliers.find(s => s.id === id);
}

/**
 * Check if supplier exists
 * Pure function - no side effects
 */
export function supplierExists(suppliers: Supplier[], id: string): boolean {
    return suppliers.some(s => s.id === id);
}

/**
 * Check for duplicate supplier name
 * Pure function - no side effects
 */
export function isDuplicateName(suppliers: Supplier[], name: string, excludeId?: string): boolean {
    return suppliers.some(s => 
        s.id !== excludeId && 
        s.name.toLowerCase() === name.toLowerCase()
    );
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter suppliers by name
 * Pure function - no side effects
 */
export function filterBySupplierName(suppliers: Supplier[], searchTerm: string): Supplier[] {
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(term));
}

/**
 * Filter active suppliers
 * Pure function - no side effects
 */
export function filterActiveSuppliers(suppliers: Supplier[]): Supplier[] {
    return suppliers.filter(s => !s.isDeleted);
}

/**
 * Get suppliers with email
 * Pure function - no side effects
 */
export function getSuppliersWithEmail(suppliers: Supplier[]): Supplier[] {
    return suppliers.filter(s => s.email);
}

/**
 * Get suppliers with phone
 * Pure function - no side effects
 */
export function getSuppliersWithPhone(suppliers: Supplier[]): Supplier[] {
    return suppliers.filter(s => s.phone);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort suppliers by name
 * Pure function - no side effects
 */
export function sortBySupplierName(suppliers: Supplier[], direction: 'asc' | 'desc' = 'asc'): Supplier[] {
    return [...suppliers].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return direction === 'asc' ? comparison : -comparison;
    });
}

/**
 * Sort suppliers by date
 * Pure function - no side effects
 */
export function sortBySupplierDate(suppliers: Supplier[], direction: 'asc' | 'desc' = 'desc'): Supplier[] {
    return [...suppliers].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
    });
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare suppliers for export
 * Pure function - no side effects
 */
export function prepareSuppliersExport(suppliers: Supplier[]): Array<Record<string, string>> {
    return suppliers.map(formatSupplierDisplay);
}

/**
 * Get table columns config
 * Pure function - no side effects
 */
export function getSupplierTableColumnsConfig(): { searchKey: string; columns: string[] } {
    return {
        searchKey: SEARCH_KEY,
        columns: ['Nama', 'Kontak', 'Alamat']
    };
}

/**
 * Get dialog title
 * Pure function - no side effects
 */
export function getSupplierDialogTitle(isEdit: boolean): string {
    return isEdit ? 'Edit Supplier' : 'Tambah Supplier';
}

/**
 * Get delete confirmation message
 * Pure function - no side effects
 */
export function getSupplierDeleteConfirmationMessage(supplier: Supplier): string {
    return `Apakah Anda yakin ingin menghapus "${supplier.name}"?`;
}

/**
 * Get success messages
 * Pure function - no side effects
 */
export const SUPPLIER_SUCCESS_MESSAGES = {
    DELETE: 'Supplier berhasil dihapus',
    CREATE: 'Supplier berhasil ditambahkan',
    UPDATE: 'Supplier berhasil diperbarui'
} as const;

/**
 * Get error messages
 * Pure function - no side effects
 */
export const SUPPLIER_ERROR_MESSAGES = {
    DELETE: 'Gagal menghapus supplier',
    FETCH: 'Gagal memuat data supplier',
    CREATE: 'Gagal menambahkan supplier',
    UPDATE: 'Gagal memperbarui supplier'
} as const;
