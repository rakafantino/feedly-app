// ============================================================================
// TYPES
// ============================================================================

export interface Customer {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    createdAt?: string;
    updatedAt?: string;
    isDeleted?: boolean;
}

export interface CustomerState {
    open: boolean;
    editingCustomer: Customer | null;
    deleteOpen: boolean;
    customerToDelete: Customer | undefined;
    deleteLoading: boolean;
}

export interface CustomerApiResponse {
    success: boolean;
    data?: Customer | Customer[];
    error?: string;
}

export interface DeleteConfirmation {
    isOpen: boolean;
    customer: Customer | undefined;
    loading: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const QUERY_KEYS = ['customers'] as const;

export const API_ENDPOINTS = {
    LIST: '/api/customers',
    GET: (id: string) => `/api/customers/${id}`,
    DELETE: (id: string) => `/api/customers/${id}`
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
export function createInitialState(): CustomerState {
    return {
        open: false,
        editingCustomer: null,
        deleteOpen: false,
        customerToDelete: undefined,
        deleteLoading: false
    };
}

/**
 * Create empty customer
 * Pure function - no side effects
 */
export function createEmptyCustomer(): Customer {
    return {
        id: '',
        name: '',
        phone: null,
        address: null
    };
}

/**
 * Create initial delete confirmation
 * Pure function - no side effects
 */
export function createInitialDeleteConfirmation(): DeleteConfirmation {
    return {
        isOpen: false,
        customer: undefined,
        loading: false
    };
}

/**
 * Create empty state for dialog
 * Pure function - no side effects
 */
export function createEmptyDialogState(): { open: boolean; editingCustomer: Customer | null } {
    return {
        open: false,
        editingCustomer: null
    };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set dialog open state
 * Pure function - no side effects
 */
export function setDialogOpen(current: CustomerState, open: boolean): CustomerState {
    return { ...current, open };
}

/**
 * Set editing customer
 * Pure function - no side effects
 */
export function setEditingCustomer(current: CustomerState, customer: Customer | null): CustomerState {
    return { ...current, editingCustomer: customer };
}

/**
 * Open dialog for new customer
 * Pure function - no side effects
 */
export function openNewCustomerDialog(current: CustomerState): CustomerState {
    return {
        ...current,
        open: true,
        editingCustomer: null
    };
}

/**
 * Open dialog for edit
 * Pure function - no side effects
 */
export function openEditDialog(current: CustomerState, customer: Customer): CustomerState {
    return {
        ...current,
        open: true,
        editingCustomer: customer
    };
}

/**
 * Close dialog
 * Pure function - no side effects
 */
export function closeDialog(current: CustomerState): CustomerState {
    return {
        ...current,
        open: false,
        editingCustomer: null
    };
}

/**
 * Set delete confirmation open
 * Pure function - no side effects
 */
export function setDeleteOpen(current: CustomerState, deleteOpen: boolean): CustomerState {
    return { ...current, deleteOpen };
}

/**
 * Set customer to delete
 * Pure function - no side effects
 */
export function setCustomerToDelete(current: CustomerState, customer: Customer | undefined): CustomerState {
    return { ...current, customerToDelete: customer };
}

/**
 * Open delete confirmation
 * Pure function - no side effects
 */
export function openDeleteConfirmation(current: CustomerState, customer: Customer): CustomerState {
    return {
        ...current,
        deleteOpen: true,
        customerToDelete: customer
    };
}

/**
 * Close delete confirmation
 * Pure function - no side effects
 */
export function closeDeleteConfirmation(current: CustomerState): CustomerState {
    return {
        ...current,
        deleteOpen: false,
        customerToDelete: undefined
    };
}

/**
 * Set delete loading
 * Pure function - no side effects
 */
export function setDeleteLoading(current: CustomerState, loading: boolean): CustomerState {
    return { ...current, deleteLoading: loading };
}

/**
 * Reset all state
 * Pure function - no side effects
 */
export function resetState(): CustomerState {
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
export function isDeleteSuccess(response: CustomerApiResponse): boolean {
    return response.success === true;
}

/**
 * Parse customer list from response
 * Pure function - no side effects
 */
export function parseCustomerList(json: unknown): Customer[] {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    const response = json as { customers?: Customer[] };
    return response.customers || [];
}

/**
 * Get error message from response
 * Pure function - no side effects
 */
export function getErrorMessage(response: CustomerApiResponse): string {
    return response.error || 'Terjadi kesalahan';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate customer for delete
 * Pure function - no side effects
 */
export function validateDelete(customer: Customer | undefined): { valid: boolean; error?: string } {
    if (!customer) {
        return { valid: false, error: 'Pelanggan tidak ditemukan' };
    }
    if (!customer.id) {
        return { valid: false, error: 'ID pelanggan tidak valid' };
    }
    return { valid: true };
}

/**
 * Check if can delete
 * Pure function - no side effects
 */
export function canDelete(customer: Customer | undefined): boolean {
    return validateDelete(customer).valid;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format customer for display
 * Pure function - no side effects
 */
export function formatCustomerDisplay(customer: Customer): Record<string, string> {
    return {
        'Nama': customer.name || '-',
        'Telepon': customer.phone || '-',
        'Alamat': customer.address || '-',
        'Bergabung': customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('id-ID') : '-'
    };
}

/**
 * Get customer summary
 * Pure function - no side effects
 */
export function getCustomerSummary(customers: Customer[]): string {
    const total = customers.length;
    const active = customers.filter(c => !c.isDeleted).length;
    const withPhone = customers.filter(c => c.phone).length;
    
    return `Total: ${total} | Aktif: ${active} | Ada Telepon: ${withPhone}`;
}

/**
 * Format phone for display
 * Pure function - no side effects
 */
export function formatPhone(phone: string | null | undefined): string {
    return phone || '-';
}

/**
 * Format address for display
 * Pure function - no side effects
 */
export function formatAddress(address: string | null | undefined): string {
    return address || '-';
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if customer changed
 * Pure function - no side effects
 */
export function hasCustomerChanged(original: Customer, updated: Partial<Customer>): boolean {
    return (
        original.name !== (updated.name || original.name) ||
        (original.phone || '') !== (updated.phone || original.phone || '') ||
        (original.address || '') !== (updated.address || original.address || '')
    );
}

/**
 * Find customer by ID
 * Pure function - no side effects
 */
export function findCustomerById(customers: Customer[], id: string): Customer | undefined {
    return customers.find(c => c.id === id);
}

/**
 * Check if customer exists
 * Pure function - no side effects
 */
export function customerExists(customers: Customer[], id: string): boolean {
    return customers.some(c => c.id === id);
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter customers by name
 * Pure function - no side effects
 */
export function filterByName(customers: Customer[], searchTerm: string): Customer[] {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term));
}

/**
 * Filter active customers
 * Pure function - no side effects
 */
export function filterActiveCustomers(customers: Customer[]): Customer[] {
    return customers.filter(c => !c.isDeleted);
}

/**
 * Get customers with phone
 * Pure function - no side effects
 */
export function getCustomersWithPhone(customers: Customer[]): Customer[] {
    return customers.filter(c => c.phone);
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort customers by name
 * Pure function - no side effects
 */
export function sortByName(customers: Customer[], direction: 'asc' | 'desc' = 'asc'): Customer[] {
    return [...customers].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return direction === 'asc' ? comparison : -comparison;
    });
}

/**
 * Sort customers by date
 * Pure function - no side effects
 */
export function sortByDate(customers: Customer[], direction: 'asc' | 'desc' = 'desc'): Customer[] {
    return [...customers].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
    });
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare customers for export
 * Pure function - no side effects
 */
export function prepareCustomersExport(customers: Customer[]): Array<Record<string, string>> {
    return customers.map(formatCustomerDisplay);
}

/**
 * Get table columns config
 * Pure function - no side effects
 */
export function getTableColumnsConfig(): { searchKey: string; columns: string[] } {
    return {
        searchKey: SEARCH_KEY,
        columns: ['Nama', 'Telepon', 'Alamat', 'Bergabung']
    };
}

/**
 * Get dialog title
 * Pure function - no side effects
 */
export function getDialogTitle(isEdit: boolean): string {
    return isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan';
}

/**
 * Get delete confirmation message
 * Pure function - no side effects
 */
export function getDeleteConfirmationMessage(customer: Customer): string {
    return `Apakah Anda yakin ingin menghapus "${customer.name}"?`;
}

/**
 * Get success messages
 * Pure function - no side effects
 */
export const SUCCESS_MESSAGES = {
    DELETE: 'Pelanggan berhasil dihapus',
    CREATE: 'Pelanggan berhasil ditambahkan',
    UPDATE: 'Pelanggan berhasil diperbarui'
} as const;

/**
 * Get error messages
 * Pure function - no side effects
 */
export const ERROR_MESSAGES = {
    DELETE: 'Gagal menghapus pelanggan',
    FETCH: 'Gagal memuat data pelanggan',
    CREATE: 'Gagal menambahkan pelanggan',
    UPDATE: 'Gagal memperbarui pelanggan'
} as const;
