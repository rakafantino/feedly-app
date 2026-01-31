// ============================================================================
// TYPES
// ============================================================================

export interface Customer {
    id?: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    createdAt?: string;
    updatedAt?: string;
    isDeleted?: boolean;
}

export interface CustomerFormData {
    name: string;
    phone: string;
    address: string;
}

export interface CustomerState {
    loading: boolean;
    isEdit: boolean;
}

export interface CustomerApiResponse {
    success: boolean;
    data?: Customer;
    error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const NAME_MIN_LENGTH = 1;
export const PHONE_MAX_LENGTH = 20;
export const ADDRESS_MAX_LENGTH = 500;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create empty form values
 * Pure function - no side effects
 */
export function createEmptyFormValues(): CustomerFormData {
    return {
        name: '',
        phone: '',
        address: ''
    };
}

/**
 * Create initial state
 * Pure function - no side effects
 */
export function createInitialState(): CustomerState {
    return {
        loading: false,
        isEdit: false
    };
}

/**
 * Create form values from customer
 * Pure function - no side effects
 */
export function createFormValuesFromCustomer(customer: Customer | null): CustomerFormData {
    if (!customer) {
        return createEmptyFormValues();
    }
    
    return {
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || ''
    };
}

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform form data to API payload
 * Pure function - no side effects
 */
export function transformToApiPayload(data: CustomerFormData): Record<string, unknown> {
    return {
        name: data.name,
        phone: data.phone || null,
        address: data.address || null
    };
}

/**
 * Transform API response to customer
 * Pure function - no side effects
 */
export function transformApiResponseToCustomer(response: CustomerApiResponse): Customer | null {
    if (!response.success || !response.data) {
        return null;
    }
    return response.data;
}

/**
 * Transform customer for display
 * Pure function - no side effects
 */
export function transformCustomerForDisplay(customer: Customer): Record<string, string> {
    return {
        'Nama': customer.name || '-',
        'Telepon': customer.phone || '-',
        'Alamat': customer.address || '-'
    };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate name
 * Pure function - no side effects
 */
export function validateName(value: string): { valid: boolean; error?: string } {
    if (!value.trim()) {
        return { valid: false, error: 'Nama pelanggan wajib diisi' };
    }
    return { valid: true };
}

/**
 * Validate phone
 * Pure function - no side effects
 */
export function validatePhone(value: string): { valid: boolean; error?: string } {
    if (value && value.length > PHONE_MAX_LENGTH) {
        return { valid: false, error: `Telepon maksimal ${PHONE_MAX_LENGTH} karakter` };
    }
    return { valid: true };
}

/**
 * Validate address
 * Pure function - no side effects
 */
export function validateAddress(value: string): { valid: boolean; error?: string } {
    if (value && value.length > ADDRESS_MAX_LENGTH) {
        return { valid: false, error: `Alamat maksimal ${ADDRESS_MAX_LENGTH} karakter` };
    }
    return { valid: true };
}

/**
 * Validate all form fields
 * Pure function - no side effects
 */
export function validateForm(data: CustomerFormData): Record<string, string> {
    const errors: Record<string, string> = {};
    
    const nameResult = validateName(data.name);
    if (!nameResult.valid) errors.name = nameResult.error || '';
    
    const phoneResult = validatePhone(data.phone);
    if (!phoneResult.valid) errors.phone = phoneResult.error || '';
    
    const addressResult = validateAddress(data.address);
    if (!addressResult.valid) errors.address = addressResult.error || '';
    
    return errors;
}

/**
 * Check if form is valid
 * Pure function - no side effects
 */
export function isFormValid(errors: Record<string, string>): boolean {
    return Object.keys(errors).length === 0;
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if name changed
 * Pure function - no side effects
 */
export function hasNameChanged(original: Customer | null, current: CustomerFormData): boolean {
    if (!original) return true;
    return original.name !== current.name;
}

/**
 * Check if data changed
 * Pure function - no side effects
 */
export function hasDataChanged(original: Customer, current: CustomerFormData): boolean {
    return (
        original.name !== current.name ||
        (original.phone || '') !== current.phone ||
        (original.address || '') !== current.address
    );
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format customer summary
 * Pure function - no side effects
 */
export function formatCustomerSummary(customer: CustomerFormData): string {
    const parts = [customer.name];
    if (customer.phone) parts.push(customer.phone);
    return parts.join(' - ');
}

/**
 * Format phone for display
 * Pure function - no side effects
 */
export function formatPhone(phone: string): string {
    if (!phone) return '-';
    return phone;
}

/**
 * Truncate address for display
 * Pure function - no side effects
 */
export function truncateAddress(address: string, maxLength: number = 50): string {
    if (!address) return '-';
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set loading state
 * Pure function - no side effects
 */
export function setLoadingState(current: CustomerState, loading: boolean): CustomerState {
    return { ...current, loading };
}

/**
 * Set edit mode
 * Pure function - no side effects
 */
export function setEditMode(current: CustomerState, isEdit: boolean): CustomerState {
    return { ...current, isEdit };
}

/**
 * Reset state
 * Pure function - no side effects
 */
export function resetState(): CustomerState {
    return createInitialState();
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Build API URL and method
 * Pure function - no side effects
 */
export function buildApiUrl(customer: Customer | null): { url: string; method: string } {
    if (customer?.id) {
        return { url: `/api/customers/${customer.id}`, method: 'PATCH' };
    }
    return { url: '/api/customers', method: 'POST' };
}

/**
 * Check if API call was successful
 * Pure function - no side effects
 */
export function isApiSuccess(response: CustomerApiResponse): boolean {
    return response.success === true;
}

/**
 * Get error message from API response
 * Pure function - no side effects
 */
export function getApiErrorMessage(response: CustomerApiResponse): string {
    return response.error || 'Terjadi kesalahan';
}

/**
 * Parse API response
 * Pure function - no side effects
 */
export function parseApiResponse(json: unknown): CustomerApiResponse {
    return json as CustomerApiResponse;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Get dialog title
 * Pure function - no side effects
 */
export function getDialogTitle(isEdit: boolean): string {
    return isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan';
}

/**
 * Get dialog description
 * Pure function - no side effects
 */
export function getDialogDescription(isEdit: boolean): string {
    return isEdit
        ? 'Ubah detail pelanggan di bawah ini.'
        : 'Masukkan detail pelanggan baru.';
}

/**
 * Get submit button text
 * Pure function - no side effects
 */
export function getSubmitButtonText(loading: boolean): string {
    return loading ? 'Menyimpan...' : 'Simpan';
}

/**
 * Get success message
 * Pure function - no side effects
 */
export function getSuccessMessage(isEdit: boolean): string {
    return isEdit
        ? 'Pelanggan berhasil diperbarui'
        : 'Pelanggan berhasil ditambahkan';
}

/**
 * Get placeholder text
 * Pure function - no side effects
 */
export function getPlaceholders(): { name: string; phone: string; address: string } {
    return {
        name: 'Contoh: Pak Budi',
        phone: '0812...',
        address: 'Jl. Mawar...'
    };
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare customers for export
 * Pure function - no side effects
 */
export function prepareCustomersExport(customers: Customer[]): Array<Record<string, string>> {
    return customers.map(customer => ({
        'Nama': customer.name || '-',
        'Telepon': customer.phone || '-',
        'Alamat': customer.address || '-',
        'Status': customer.isDeleted ? 'Tidak Aktif' : 'Aktif'
    }));
}

/**
 * Get customers summary
 * Pure function - no side effects
 */
export function getCustomersSummary(customers: Customer[]): string {
    const total = customers.length;
    const active = customers.filter(c => !c.isDeleted).length;
    const withPhone = customers.filter(c => c.phone).length;
    
    return `Total: ${total} | Aktif: ${active} | Ada Telepon: ${withPhone}`;
}
