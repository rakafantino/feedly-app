/**
 * TDD Tests for supplier-dialog-core.ts
 */

import {
    // Constants
    CODE_MIN_LENGTH,
    CODE_MAX_LENGTH,
    NAME_MIN_LENGTH,
    NAME_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    ADDRESS_MAX_LENGTH,
    
    // Initialization
    createEmptyFormValues,
    createInitialState,
    createFormValuesFromSupplier,
    
    // Transformation
    transformToApiPayload,
    transformApiResponseToSupplier,
    transformSupplierForDisplay,
    
    // Validation
    validateCode,
    validateName,
    validateEmail,
    validatePhone,
    validateAddress,
    validateForm,
    isFormValid,
    
    // Code Generation
    cleanNameForCode,
    generateCodeFromName,
    canGenerateCode,
    
    // Comparison
    hasCodeChanged,
    hasDataChanged,
    
    // Formatting
    formatSupplierSummary,
    formatSupplierForList,
    truncateText,
    
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
    getCodeGenerationError,
    getPlaceholders,
    
    // Export
    prepareSuppliersExport,
    getSuppliersSummary
} from '../supplier-dialog-core';
import { Supplier, SupplierFormData, SupplierState, SupplierApiResponse } from '../supplier-dialog-core';

describe('Constants', () => {
    it('has correct CODE_MAX_LENGTH', () => {
        expect(CODE_MAX_LENGTH).toBe(20);
    });
    
    it('has correct NAME_MAX_LENGTH', () => {
        expect(NAME_MAX_LENGTH).toBe(100);
    });
    
    it('has correct EMAIL_MAX_LENGTH', () => {
        expect(EMAIL_MAX_LENGTH).toBe(100);
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
        expect(result.code).toBe('');
        expect(result.name).toBe('');
        expect(result.email).toBe('');
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

describe('createFormValuesFromSupplier', () => {
    it('creates from supplier', () => {
        const supplier: Supplier = {
            id: '1',
            code: 'SUP-001',
            name: 'PT Maju',
            email: 'supplier@email.com',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const result = createFormValuesFromSupplier(supplier);
        expect(result.code).toBe('SUP-001');
        expect(result.name).toBe('PT Maju');
        expect(result.email).toBe('supplier@email.com');
    });
    
    it('creates empty for null supplier', () => {
        const result = createFormValuesFromSupplier(null);
        expect(result.code).toBe('');
        expect(result.name).toBe('');
    });
});

describe('transformToApiPayload', () => {
    it('transforms form data correctly', () => {
        const data: SupplierFormData = {
            code: 'SUP-001',
            name: 'PT Maju',
            email: 'supplier@email.com',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const result = transformToApiPayload(data);
        expect(result.code).toBe('SUP-001');
        expect(result.name).toBe('PT Maju');
        expect(result.email).toBe('supplier@email.com');
        expect(result.phone).toBe('08123456789');
    });
    
    it('converts empty optional fields to null', () => {
        const data: SupplierFormData = {
            code: 'SUP-001',
            name: 'PT Maju',
            email: '',
            phone: '',
            address: ''
        };
        const result = transformToApiPayload(data);
        expect(result.email).toBeNull();
        expect(result.phone).toBeNull();
        expect(result.address).toBeNull();
    });
});

describe('transformApiResponseToSupplier', () => {
    it('returns supplier for success', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju' };
        const response: SupplierApiResponse = { success: true, data: supplier };
        expect(transformApiResponseToSupplier(response)).toEqual(supplier);
    });
    
    it('returns null for failed response', () => {
        const response: SupplierApiResponse = { success: false, error: 'Error' };
        expect(transformApiResponseToSupplier(response)).toBeNull();
    });
});

describe('transformSupplierForDisplay', () => {
    it('transforms for display', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju', email: 'a@b.com', phone: '0812', address: 'Jl. Jkt' };
        const result = transformSupplierForDisplay(supplier);
        expect(result['Kode']).toBe('SUP-001');
        expect(result['Nama']).toBe('PT Maju');
        expect(result['Email']).toBe('a@b.com');
    });
    
    it('handles null values', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju' };
        const result = transformSupplierForDisplay(supplier);
        expect(result['Email']).toBe('-');
        expect(result['Telepon']).toBe('-');
    });
});

describe('validateCode', () => {
    it('returns error for empty', () => {
        const result = validateCode('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('wajib diisi');
    });
    
    it('returns error for too long', () => {
        const long = 'A'.repeat(CODE_MAX_LENGTH + 1);
        const result = validateCode(long);
        expect(result.valid).toBe(false);
    });
    
    it('returns valid for proper code', () => {
        const result = validateCode('SUP-001');
        expect(result.valid).toBe(true);
    });
});

describe('validateName', () => {
    it('returns error for empty', () => {
        const result = validateName('');
        expect(result.valid).toBe(false);
    });
    
    it('returns error for too long', () => {
        const long = 'A'.repeat(NAME_MAX_LENGTH + 1);
        const result = validateName(long);
        expect(result.valid).toBe(false);
    });
    
    it('returns valid for proper name', () => {
        const result = validateName('PT Maju Bersama');
        expect(result.valid).toBe(true);
    });
});

describe('validateEmail', () => {
    it('returns valid for empty', () => {
        const result = validateEmail('');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for invalid format', () => {
        const result = validateEmail('invalid');
        expect(result.valid).toBe(false);
    });
    
    it('returns valid for proper email', () => {
        const result = validateEmail('supplier@email.com');
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
        const long = '0'.repeat(PHONE_MAX_LENGTH + 1);
        const result = validatePhone(long);
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
        const long = 'A'.repeat(ADDRESS_MAX_LENGTH + 1);
        const result = validateAddress(long);
        expect(result.valid).toBe(false);
    });
});

describe('validateForm', () => {
    it('returns empty errors for valid form', () => {
        const data: SupplierFormData = {
            code: 'SUP-001',
            name: 'PT Maju',
            email: 'supplier@email.com',
            phone: '08123456789',
            address: 'Jl. Jakarta'
        };
        const errors = validateForm(data);
        expect(isFormValid(errors)).toBe(true);
    });
    
    it('returns error for missing code', () => {
        const data: SupplierFormData = {
            code: '',
            name: 'PT Maju',
            email: '',
            phone: '',
            address: ''
        };
        const errors = validateForm(data);
        expect(errors.code).toContain('wajib diisi');
    });
    
    it('returns error for missing name', () => {
        const data: SupplierFormData = {
            code: 'SUP-001',
            name: '',
            email: '',
            phone: '',
            address: ''
        };
        const errors = validateForm(data);
        expect(errors.name).toContain('wajib diisi');
    });
});

describe('cleanNameForCode', () => {
    it('removes PT prefix', () => {
        expect(cleanNameForCode('PT Maju Bersama')).toBe('Maju Bersama');
    });
    
    it('removes CV prefix', () => {
        expect(cleanNameForCode('CV Sukses')).toBe('Sukses');
    });
    
    it('removes UD prefix', () => {
        expect(cleanNameForCode('UD Sumber Rejeki')).toBe('Sumber Rejeki');
    });
    
    it('handles name without prefix', () => {
        expect(cleanNameForCode('Maju Bersama')).toBe('Maju Bersama');
    });
    
    it('handles leading whitespace', () => {
        // Leading whitespace prevents prefix matching
        expect(cleanNameForCode('  PT Maju  ')).toBe('PT Maju');
    });
});

describe('generateCodeFromName', () => {
    it('generates code with 3-letter prefix', () => {
        const code = generateCodeFromName('Maju Bersama');
        expect(code).toMatch(/MAJ-\d{3}/);
    });
    
    it('generates unique codes', () => {
        const code1 = generateCodeFromName('Supplier A');
        const code2 = generateCodeFromName('Supplier A');
        // Codes should be different due to random suffix
        expect(code1).not.toBe(code2);
    });
    
    it('handles short names', () => {
        const code = generateCodeFromName('AB');
        expect(code).toMatch(/AB-\d{3}/);
    });
});

describe('canGenerateCode', () => {
    it('returns false for empty name', () => {
        const result = canGenerateCode('');
        expect(result.can).toBe(false);
        expect(result.error).toBe('Isi nama supplier terlebih dahulu');
    });
    
    it('returns true for non-empty name', () => {
        const result = canGenerateCode('PT Maju');
        expect(result.can).toBe(true);
    });
    
    it('returns false for whitespace only', () => {
        const result = canGenerateCode('   ');
        expect(result.can).toBe(false);
    });
});

describe('hasCodeChanged', () => {
    it('returns true for new supplier', () => {
        expect(hasCodeChanged(null, { code: 'SUP-001', name: 'PT Maju', email: '', phone: '', address: '' })).toBe(true);
    });
    
    it('detects code change', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju' };
        expect(hasCodeChanged(supplier, { code: 'SUP-002', name: 'PT Maju', email: '', phone: '', address: '' })).toBe(true);
    });
});

describe('hasDataChanged', () => {
    it('detects changes', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju', email: 'a@b.com', phone: '0812', address: 'Jl. Jkt' };
        const form: SupplierFormData = { code: 'SUP-002', name: 'PT Jaya', email: 'b@c.com', phone: '0899', address: 'Jl. BSD' };
        expect(hasDataChanged(supplier, form)).toBe(true);
    });
    
    it('detects no changes', () => {
        const supplier: Supplier = { id: '1', code: 'SUP-001', name: 'PT Maju', email: 'a@b.com', phone: '0812', address: 'Jl. Jkt' };
        const form: SupplierFormData = { code: 'SUP-001', name: 'PT Maju', email: 'a@b.com', phone: '0812', address: 'Jl. Jkt' };
        expect(hasDataChanged(supplier, form)).toBe(false);
    });
});

describe('formatSupplierSummary', () => {
    it('formats correctly', () => {
        const result = formatSupplierSummary({ code: 'SUP-001', name: 'PT Maju', email: '', phone: '', address: '' });
        expect(result).toBe('SUP-001 - PT Maju');
    });
});

describe('formatSupplierForList', () => {
    it('formats for list', () => {
        const result = formatSupplierForList({ id: '1', code: 'SUP-001', name: 'PT Maju', phone: '0812' });
        expect(result).toBe('SUP-001 | PT Maju | 0812');
    });
    
    it('formats without phone', () => {
        const result = formatSupplierForList({ id: '1', code: 'SUP-001', name: 'PT Maju' });
        expect(result).toBe('SUP-001 | PT Maju');
    });
});

describe('truncateText', () => {
    it('returns original if short', () => {
        expect(truncateText('Short text', 50)).toBe('Short text');
    });
    
    it('truncates long text', () => {
        // maxLength 20 = 17 chars + "..." = 20 total
        expect(truncateText('This is a very long text that should be truncated', 20)).toBe('This is a very lo...');
    });
    
    it('returns dash for empty', () => {
        expect(truncateText('', 50)).toBe('-');
    });
});

describe('setLoadingState', () => {
    it('updates loading state', () => {
        const state = createInitialState();
        const result = setLoadingState(state, true);
        expect(result.loading).toBe(true);
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
        const state: SupplierState = { loading: true, isEdit: true };
        const result = resetState();
        expect(result.loading).toBe(false);
        expect(result.isEdit).toBe(false);
    });
});

describe('buildApiUrl', () => {
    it('returns create URL for new supplier', () => {
        const result = buildApiUrl(null);
        expect(result.url).toBe('/api/suppliers');
        expect(result.method).toBe('POST');
    });
    
    it('returns update URL for existing supplier', () => {
        const result = buildApiUrl({ id: '1', code: 'SUP-001', name: 'PT Maju' });
        expect(result.url).toBe('/api/suppliers/1');
        expect(result.method).toBe('PUT');
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
        const json = { success: true, data: { id: '1', code: 'SUP-001', name: 'PT Maju' } };
        const result = parseApiResponse(json);
        expect(result.success).toBe(true);
        expect(result.data?.code).toBe('SUP-001');
    });
});

describe('getDialogTitle', () => {
    it('returns correct title', () => {
        expect(getDialogTitle(false)).toBe('Tambah Supplier');
        expect(getDialogTitle(true)).toBe('Edit Supplier');
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
        expect(getSuccessMessage(false)).toBe('Supplier berhasil ditambahkan');
        expect(getSuccessMessage(true)).toBe('Supplier berhasil diperbarui');
    });
});

describe('getCodeGenerationError', () => {
    it('returns error message', () => {
        expect(getCodeGenerationError()).toBe('Isi nama supplier terlebih dahulu');
    });
});

describe('getPlaceholders', () => {
    it('returns placeholders', () => {
        const result = getPlaceholders();
        expect(result.code).toBe('SUP-001');
        expect(result.name).toBe('PT Maju Bersama');
        expect(result.email).toBe('supplier@email.com');
    });
});

describe('prepareSuppliersExport', () => {
    it('prepares export data', () => {
        const suppliers: Supplier[] = [
            { id: '1', code: 'SUP-001', name: 'PT Maju', email: 'a@b.com', phone: '0812', address: 'Jl. Jkt', isDeleted: false },
            { id: '2', code: 'SUP-002', name: 'PT Jaya', isDeleted: true }
        ];
        const result = prepareSuppliersExport(suppliers);
        expect(result.length).toBe(2);
        expect(result[0]['Kode']).toBe('SUP-001');
        expect(result[0]['Status']).toBe('Aktif');
        expect(result[1]['Status']).toBe('Tidak Aktif');
    });
});

describe('getSuppliersSummary', () => {
    it('returns summary', () => {
        const suppliers: Supplier[] = [
            { id: '1', code: 'SUP-001', name: 'PT Maju', email: 'a@b.com' },
            { id: '2', code: 'SUP-002', name: 'PT Jaya', isDeleted: true }
        ];
        const result = getSuppliersSummary(suppliers);
        expect(result).toContain('Total: 2');
        expect(result).toContain('Aktif: 1');
        expect(result).toContain('Ada Email: 1');
    });
});
