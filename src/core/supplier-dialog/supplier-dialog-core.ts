// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
    id?: string;
    code: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt?: string;
    updatedAt?: string;
    isDeleted?: boolean;
}

export interface SupplierFormData {
    code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
}

export interface SupplierState {
    loading: boolean;
    isEdit: boolean;
}

export interface SupplierApiResponse {
    success: boolean;
    data?: Supplier;
    error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CODE_MIN_LENGTH = 1;
export const CODE_MAX_LENGTH = 20;
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 100;
export const PHONE_MAX_LENGTH = 20;
export const ADDRESS_MAX_LENGTH = 500;
export const CODE_SUFFIX_LENGTH = 4; // "-000" format

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create empty form values
 * Pure function - no side effects
 */
export function createEmptyFormValues(): SupplierFormData {
    return {
        code: '',
        name: '',
        email: '',
        phone: '',
        address: ''
    };
}

/**
 * Create initial state
 * Pure function - no side effects
 */
export function createInitialState(): SupplierState {
    return {
        loading: false,
        isEdit: false
    };
}

/**
 * Create form values from supplier
 * Pure function - no side effects
 */
export function createFormValuesFromSupplier(supplier: Supplier | null): SupplierFormData {
    if (!supplier) {
        return createEmptyFormValues();
    }
    
    return {
        code: supplier.code || '',
        name: supplier.name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || ''
    };
}

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform form data to API payload
 * Pure function - no side effects
 */
export function transformToApiPayload(data: SupplierFormData): Record<string, unknown> {
    return {
        code: data.code,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null
    };
}

/**
 * Transform API response to supplier
 * Pure function - no side effects
 */
export function transformApiResponseToSupplier(response: SupplierApiResponse): Supplier | null {
    if (!response.success || !response.data) {
        return null;
    }
    return response.data;
}

/**
 * Transform supplier for display
 * Pure function - no side effects
 */
export function transformSupplierForDisplay(supplier: Supplier): Record<string, string> {
    return {
        'Kode': supplier.code || '-',
        'Nama': supplier.name || '-',
        'Email': supplier.email || '-',
        'Telepon': supplier.phone || '-',
        'Alamat': supplier.address || '-'
    };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate code
 * Pure function - no side effects
 */
export function validateCode(value: string): { valid: boolean; error?: string } {
    if (!value.trim()) {
        return { valid: false, error: 'Kode supplier wajib diisi' };
    }
    if (value.length > CODE_MAX_LENGTH) {
        return { valid: false, error: `Kode maksimal ${CODE_MAX_LENGTH} karakter` };
    }
    return { valid: true };
}

/**
 * Validate name
 * Pure function - no side effects
 */
export function validateName(value: string): { valid: boolean; error?: string } {
    if (!value.trim()) {
        return { valid: false, error: 'Nama supplier wajib diisi' };
    }
    if (value.length > NAME_MAX_LENGTH) {
        return { valid: false, error: `Nama maksimal ${NAME_MAX_LENGTH} karakter` };
    }
    return { valid: true };
}

/**
 * Validate email
 * Pure function - no side effects
 */
export function validateEmail(value: string): { valid: boolean; error?: string } {
    if (!value) return { valid: true };
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        return { valid: false, error: 'Email tidak valid' };
    }
    if (value.length > EMAIL_MAX_LENGTH) {
        return { valid: false, error: `Email maksimal ${EMAIL_MAX_LENGTH} karakter` };
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
export function validateForm(data: SupplierFormData): Record<string, string> {
    const errors: Record<string, string> = {};
    
    const codeResult = validateCode(data.code);
    if (!codeResult.valid) errors.code = codeResult.error || '';
    
    const nameResult = validateName(data.name);
    if (!nameResult.valid) errors.name = nameResult.error || '';
    
    const emailResult = validateEmail(data.email);
    if (!emailResult.valid) errors.email = emailResult.error || '';
    
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
// CODE GENERATION
// ============================================================================

/**
 * Clean supplier name for code generation
 * Pure function - no side effects
 */
export function cleanNameForCode(name: string): string {
    // Remove common prefixes
    const cleaned = name.replace(/^(PT|CV|UD|TB|TOKO)\.?\s+/i, '').trim();
    return cleaned;
}

/**
 * Generate code from name
 * Pure function - no side effects
 */
export function generateCodeFromName(name: string): string {
    const cleaned = cleanNameForCode(name);
    const prefix = cleaned.substring(0, 3).toUpperCase();
    const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${suffix}`;
}

/**
 * Validate name before code generation
 * Pure function - no side effects
 */
export function canGenerateCode(name: string): { can: boolean; error?: string } {
    if (!name.trim()) {
        return { can: false, error: 'Isi nama supplier terlebih dahulu' };
    }
    return { can: true };
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if code changed
 * Pure function - no side effects
 */
export function hasCodeChanged(original: Supplier | null, current: SupplierFormData): boolean {
    if (!original) return true;
    return original.code !== current.code;
}

/**
 * Check if data changed
 * Pure function - no side effects
 */
export function hasDataChanged(original: Supplier, current: SupplierFormData): boolean {
    return (
        original.code !== current.code ||
        original.name !== current.name ||
        (original.email || '') !== current.email ||
        (original.phone || '') !== current.phone ||
        (original.address || '') !== current.address
    );
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format supplier summary
 * Pure function - no side effects
 */
export function formatSupplierSummary(supplier: SupplierFormData): string {
    return `${supplier.code} - ${supplier.name}`;
}

/**
 * Format supplier for list display
 * Pure function - no side effects
 */
export function formatSupplierForList(supplier: Supplier): string {
    const parts = [supplier.code, supplier.name];
    if (supplier.phone) parts.push(supplier.phone);
    return parts.join(' | ');
}

/**
 * Truncate text for display
 * Pure function - no side effects
 */
export function truncateText(text: string, maxLength: number = 30): string {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set loading state
 * Pure function - no side effects
 */
export function setLoadingState(current: SupplierState, loading: boolean): SupplierState {
    return { ...current, loading };
}

/**
 * Set edit mode
 * Pure function - no side effects
 */
export function setEditMode(current: SupplierState, isEdit: boolean): SupplierState {
    return { ...current, isEdit };
}

/**
 * Reset state
 * Pure function - no side effects
 */
export function resetState(): SupplierState {
    return createInitialState();
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Build API URL and method
 * Pure function - no side effects
 */
export function buildApiUrl(supplier: Supplier | null): { url: string; method: string } {
    if (supplier?.id) {
        return { url: `/api/suppliers/${supplier.id}`, method: 'PUT' };
    }
    return { url: '/api/suppliers', method: 'POST' };
}

/**
 * Check if API call was successful
 * Pure function - no side effects
 */
export function isApiSuccess(response: SupplierApiResponse): boolean {
    return response.success === true;
}

/**
 * Get error message from API response
 * Pure function - no side effects
 */
export function getApiErrorMessage(response: SupplierApiResponse): string {
    return response.error || 'Terjadi kesalahan';
}

/**
 * Parse API response
 * Pure function - no side effects
 */
export function parseApiResponse(json: unknown): SupplierApiResponse {
    return json as SupplierApiResponse;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Get dialog title
 * Pure function - no side effects
 */
export function getDialogTitle(isEdit: boolean): string {
    return isEdit ? 'Edit Supplier' : 'Tambah Supplier';
}

/**
 * Get dialog description
 * Pure function - no side effects
 */
export function getDialogDescription(isEdit: boolean): string {
    return isEdit
        ? 'Ubah detail supplier di bawah ini.'
        : 'Masukkan detail supplier baru.';
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
        ? 'Supplier berhasil diperbarui'
        : 'Supplier berhasil ditambahkan';
}

/**
 * Get code generation error
 * Pure function - no side effects
 */
export function getCodeGenerationError(): string {
    return 'Isi nama supplier terlebih dahulu';
}

/**
 * Get placeholders
 * Pure function - no side effects
 */
export function getPlaceholders(): { code: string; name: string; email: string; phone: string; address: string } {
    return {
        code: 'SUP-001',
        name: 'PT Maju Bersama',
        email: 'supplier@email.com',
        phone: '0812...',
        address: 'Jl. Industri...'
    };
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare suppliers for export
 * Pure function - no side effects
 */
export function prepareSuppliersExport(suppliers: Supplier[]): Array<Record<string, string>> {
    return suppliers.map(supplier => ({
        'Kode': supplier.code || '-',
        'Nama': supplier.name || '-',
        'Email': supplier.email || '-',
        'Telepon': supplier.phone || '-',
        'Alamat': supplier.address || '-',
        'Status': supplier.isDeleted ? 'Tidak Aktif' : 'Aktif'
    }));
}

/**
 * Get suppliers summary
 * Pure function - no side effects
 */
export function getSuppliersSummary(suppliers: Supplier[]): string {
    const total = suppliers.length;
    const active = suppliers.filter(s => !s.isDeleted).length;
    const withEmail = suppliers.filter(s => s.email).length;
    
    return `Total: ${total} | Aktif: ${active} | Ada Email: ${withEmail}`;
}
