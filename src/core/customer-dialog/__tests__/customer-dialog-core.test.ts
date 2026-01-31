/**
 * TDD Tests for customer-dialog-core.ts
 */

import {
    // Constants
    NAME_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    ADDRESS_MAX_LENGTH,
    
    // Initialization
    createEmptyFormValues,
    createInitialState,
    createFormValuesFromCustomer,
    
    // Transformation
    transformToApiPayload,
    transformApiResponseToCustomer,
    transformCustomerForDisplay,
    
    // Validation
    validateName,
    validatePhone,
    validateAddress,
    validateForm,
    isFormValid,
    
    // Comparison
    hasNameChanged,
    hasDataChanged,
    
    // Formatting
    formatCustomerSummary,
    formatPhone,
    truncateAddress,
    
    // State Management
    setLoadingState,
    setEditMode,
    resetState,
    
    // API Helpers
    buildApiUrl,
    isApiSuccess,
    getApiErrorMessage,
    parseApiResponse,
    
    // Export Helpers
    getDialogTitle,
    getDialogDescription,
    getSubmitButtonText,
    getSuccessMessage,
    getPlaceholders,
    
    // Export
    prepareCustomersExport,
    getCustomersSummary
} from '../customer-dialog-core';
import { Customer, CustomerFormData, CustomerState, CustomerApiResponse } from '../customer-dialog-core';

describe('Constants', () => {
    it('has correct NAME_MIN_LENGTH', () => {
        expect(NAME_MIN_LENGTH).toBe(1);
    });
    
    it('has correct PHONE_MAX_LENGTH', () => {
        expect(PHONE_MAX_LENGTH).toBe(20);
    });
    
    it('has correct ADDRESS_MAX_LENGTH', () => {
        expect(ADDRESS_MAX_LENGTH).toBe(500);
    });
});

describe('createEmptyFormValues', () => {
    it('creates empty values', () => {
        const result = createEmptyFormValues();
        expect(result.name).toBe('');
        expect(result.phone).toBe('');
        expect(result.address).toBe('');
    });
});

describe('createInitialState', () => {
    it('creates initial state', () => {
        const result = createInitialState();
        expect(result.loading).toBe(false);
        expect(result.isEdit).toBe(false);
    });
});

describe('createFormValuesFromCustomer', () => {
    it('creates from customer', () => {
        const customer: Customer = {
            id: '1',
            name: 'John Doe',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const result = createFormValuesFromCustomer(customer);
        expect(result.name).toBe('John Doe');
        expect(result.phone).toBe('08123456789');
        expect(result.address).toBe('Jl. Jakarta');
    });
    
    it('creates empty for null customer', () => {
        const result = createFormValuesFromCustomer(null);
        expect(result.name).toBe('');
        expect(result.phone).toBe('');
    });
    
    it('handles null phone and address', () => {
        const customer: Customer = { id: '1', name: 'John', phone: null, address: null };
        const result = createFormValuesFromCustomer(customer);
        expect(result.phone).toBe('');
        expect(result.address).toBe('');
    });
});

describe('transformToApiPayload', () => {
    it('transforms form data correctly', () => {
        const data: CustomerFormData = {
            name: 'John Doe',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const result = transformToApiPayload(data);
        expect(result.name).toBe('John Doe');
        expect(result.phone).toBe('08123456789');
        expect(result.address).toBe('Jl. Jakarta');
    });
    
    it('converts empty strings to null for optional fields', () => {
        const data: CustomerFormData = {
            name: 'John',
            phone: '',
            address: ''
        };
        const result = transformToApiPayload(data);
        expect(result.phone).toBeNull();
        expect(result.address).toBeNull();
    });
});

describe('transformApiResponseToCustomer', () => {
    it('returns customer for success', () => {
        const customer: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const response: CustomerApiResponse = { success: true, data: customer };
        expect(transformApiResponseToCustomer(response)).toEqual(customer);
    });
    
    it('returns null for failed response', () => {
        const response: CustomerApiResponse = { success: false, error: 'Error' };
        expect(transformApiResponseToCustomer(response)).toBeNull();
    });
    
    it('returns null for no data', () => {
        const response: CustomerApiResponse = { success: true };
        expect(transformApiResponseToCustomer(response)).toBeNull();
    });
});

describe('transformCustomerForDisplay', () => {
    it('transforms for display', () => {
        const customer: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const result = transformCustomerForDisplay(customer);
        expect(result['Nama']).toBe('John');
        expect(result['Telepon']).toBe('0812');
        expect(result['Alamat']).toBe('Jl. Jkt');
    });
    
    it('handles null values', () => {
        const customer: Customer = { id: '1', name: 'John', phone: null, address: null };
        const result = transformCustomerForDisplay(customer);
        expect(result['Telepon']).toBe('-');
        expect(result['Alamat']).toBe('-');
    });
});

describe('validateName', () => {
    it('returns error for empty', () => {
        const result = validateName('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('wajib diisi');
    });
    
    it('returns valid for non-empty', () => {
        const result = validateName('John');
        expect(result.valid).toBe(true);
    });
});

describe('validatePhone', () => {
    it('returns valid for empty', () => {
        const result = validatePhone('');
        expect(result.valid).toBe(true);
    });
    
    it('returns valid for short phone', () => {
        const result = validatePhone('0812');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for long phone', () => {
        const longPhone = '0'.repeat(PHONE_MAX_LENGTH + 1);
        const result = validatePhone(longPhone);
        expect(result.valid).toBe(false);
    });
});

describe('validateAddress', () => {
    it('returns valid for empty', () => {
        const result = validateAddress('');
        expect(result.valid).toBe(true);
    });
    
    it('returns valid for short address', () => {
        const result = validateAddress('Jl. Jakarta');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for long address', () => {
        const longAddress = 'A'.repeat(ADDRESS_MAX_LENGTH + 1);
        const result = validateAddress(longAddress);
        expect(result.valid).toBe(false);
    });
});

describe('validateForm', () => {
    it('returns empty errors for valid form', () => {
        const data: CustomerFormData = {
            name: 'John',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const errors = validateForm(data);
        expect(isFormValid(errors)).toBe(true);
    });
    
    it('returns error for missing name', () => {
        const data: CustomerFormData = {
            name: '',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const errors = validateForm(data);
        expect(errors.name).toContain('wajib diisi');
    });
    
    it('allows optional phone and address', () => {
        const data: CustomerFormData = {
            name: 'John',
            phone: '',
            address: ''
        };
        const errors = validateForm(data);
        expect(isFormValid(errors)).toBe(true);
    });
});

describe('hasNameChanged', () => {
    it('returns true for new customer', () => {
        expect(hasNameChanged(null, { name: 'John', phone: '', address: '' })).toBe(true);
    });
    
    it('detects name change', () => {
        const customer: Customer = { id: '1', name: 'John' };
        expect(hasNameChanged(customer, { name: 'Jane', phone: '', address: '' })).toBe(true);
    });
    
    it('detects no name change', () => {
        const customer: Customer = { id: '1', name: 'John' };
        expect(hasNameChanged(customer, { name: 'John', phone: '', address: '' })).toBe(false);
    });
});

describe('hasDataChanged', () => {
    it('detects changes', () => {
        const customer: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const form: CustomerFormData = { name: 'Jane', phone: '0899', address: 'Jl. BSD' };
        expect(hasDataChanged(customer, form)).toBe(true);
    });
    
    it('detects no changes', () => {
        const customer: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const form: CustomerFormData = { name: 'John', phone: '0812', address: 'Jl. Jkt' };
        expect(hasDataChanged(customer, form)).toBe(false);
    });
});

describe('formatCustomerSummary', () => {
    it('formats with name only', () => {
        const result = formatCustomerSummary({ name: 'John', phone: '', address: '' });
        expect(result).toBe('John');
    });
    
    it('formats with name and phone', () => {
        const result = formatCustomerSummary({ name: 'John', phone: '0812', address: '' });
        expect(result).toBe('John - 0812');
    });
});

describe('formatPhone', () => {
    it('returns phone', () => {
        expect(formatPhone('08123456789')).toBe('08123456789');
    });
    
    it('returns dash for empty', () => {
        expect(formatPhone('')).toBe('-');
    });
});

describe('truncateAddress', () => {
    it('returns original if short', () => {
        expect(truncateAddress('Jl. Jakarta', 50)).toBe('Jl. Jakarta');
    });
    
    it('truncates long address', () => {
        const long = 'Jl. Jakarta Selatan No. 123 RT 001 RW 002 Kel. Kebayoran Lama';
        expect(truncateAddress(long, 20)).toBe('Jl. Jakarta Selat...');
    });
    
    it('returns dash for empty', () => {
        expect(truncateAddress('', 50)).toBe('-');
    });
});

describe('setLoadingState', () => {
    it('updates loading state', () => {
        const state = createInitialState();
        const result = setLoadingState(state, true);
        expect(result.loading).toBe(true);
        expect(result.isEdit).toBe(false);
    });
});

describe('setEditMode', () => {
    it('updates edit mode', () => {
        const state = createInitialState();
        const result = setEditMode(state, true);
        expect(result.isEdit).toBe(true);
    });
});

describe('resetState', () => {
    it('resets to initial', () => {
        const state: CustomerState = { loading: true, isEdit: true };
        const result = resetState();
        expect(result.loading).toBe(false);
        expect(result.isEdit).toBe(false);
    });
});

describe('buildApiUrl', () => {
    it('returns create URL for new customer', () => {
        const result = buildApiUrl(null);
        expect(result.url).toBe('/api/customers');
        expect(result.method).toBe('POST');
    });
    
    it('returns update URL for existing customer', () => {
        const result = buildApiUrl({ id: '1', name: 'John' });
        expect(result.url).toBe('/api/customers/1');
        expect(result.method).toBe('PATCH');
    });
});

describe('isApiSuccess', () => {
    it('returns true for success', () => {
        expect(isApiSuccess({ success: true })).toBe(true);
    });
    
    it('returns false for failure', () => {
        expect(isApiSuccess({ success: false })).toBe(false);
    });
});

describe('getApiErrorMessage', () => {
    it('returns error message', () => {
        expect(getApiErrorMessage({ success: false, error: 'Error occurred' })).toBe('Error occurred');
    });
    
    it('returns default message', () => {
        expect(getApiErrorMessage({ success: false })).toBe('Terjadi kesalahan');
    });
});

describe('parseApiResponse', () => {
    it('parses response correctly', () => {
        const json = { success: true, data: { id: '1', name: 'John' } };
        const result = parseApiResponse(json);
        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('John');
    });
});

describe('getDialogTitle', () => {
    it('returns correct title', () => {
        expect(getDialogTitle(false)).toBe('Tambah Pelanggan');
        expect(getDialogTitle(true)).toBe('Edit Pelanggan');
    });
});

describe('getDialogDescription', () => {
    it('returns correct description', () => {
        expect(getDialogDescription(false)).toContain('baru');
        expect(getDialogDescription(true)).toContain('Ubah');
    });
});

describe('getSubmitButtonText', () => {
    it('returns loading text', () => {
        expect(getSubmitButtonText(true)).toBe('Menyimpan...');
    });
    
    it('returns save text', () => {
        expect(getSubmitButtonText(false)).toBe('Simpan');
    });
});

describe('getSuccessMessage', () => {
    it('returns correct message', () => {
        expect(getSuccessMessage(false)).toBe('Pelanggan berhasil ditambahkan');
        expect(getSuccessMessage(true)).toBe('Pelanggan berhasil diperbarui');
    });
});

describe('getPlaceholders', () => {
    it('returns placeholders', () => {
        const result = getPlaceholders();
        expect(result.name).toBe('Contoh: Pak Budi');
        expect(result.phone).toBe('0812...');
        expect(result.address).toBe('Jl. Mawar...');
    });
});

describe('prepareCustomersExport', () => {
    it('prepares export data', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt', isDeleted: false },
            { id: '2', name: 'Jane', phone: null, address: null, isDeleted: true }
        ];
        const result = prepareCustomersExport(customers);
        expect(result.length).toBe(2);
        expect(result[0]['Nama']).toBe('John');
        expect(result[0]['Status']).toBe('Aktif');
        expect(result[1]['Status']).toBe('Tidak Aktif');
    });
});

describe('getCustomersSummary', () => {
    it('returns summary', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' },
            { id: '2', name: 'Jane', address: 'Jl. BSD', isDeleted: true }
        ];
        const result = getCustomersSummary(customers);
        expect(result).toContain('Total: 2');
        expect(result).toContain('Aktif: 1');
        expect(result).toContain('Ada Telepon: 1');
    });
});
