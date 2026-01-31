/**
 * TDD Tests for supplier-client-core.ts
 */

import {
    // Constants
    QUERY_KEYS,
    API_ENDPOINTS,
    SEARCH_KEY,
    
    // Initialization
    createInitialState,
    createEmptySupplier,
    createEmptyDialogState,
    
    // State Management
    setDialogOpen,
    setEditingSupplier,
    openNewSupplierDialog,
    openEditDialog,
    closeDialog,
    setDeleteOpen,
    setSupplierToDelete,
    openDeleteConfirmation,
    closeDeleteConfirmation,
    setDeleteLoading,
    resetState,
    
    // API Helpers
    buildListUrl,
    buildDeleteUrl,
    isDeleteSuccess,
    parseSupplierList,
    getErrorMessage,
    
    // Validation
    validateDelete,
    canDelete,
    
    // Formatting
    formatSupplierDisplay,
    getSupplierSummary,
    formatContact,
    formatEmail,
    formatSupplierPhone,
    formatSupplierAddress,
    getContactDisplay,
    
    // Comparison
    hasSupplierChanged,
    findSupplierById,
    supplierExists,
    isDuplicateName,
    
    // Filtering
    filterBySupplierName,
    filterActiveSuppliers,
    getSuppliersWithEmail,
    getSuppliersWithPhone,
    
    // Sorting
    sortBySupplierName,
    sortBySupplierDate,
    
    // Export
    prepareSuppliersExport,
    getSupplierTableColumnsConfig,
    getSupplierDialogTitle,
    getSupplierDeleteConfirmationMessage,
    SUPPLIER_SUCCESS_MESSAGES,
    SUPPLIER_ERROR_MESSAGES
} from '../supplier-client-core';
import { Supplier, SupplierContact } from '../supplier-client-core';

describe('Constants', () => {
    it('has correct QUERY_KEYS', () => {
        expect(QUERY_KEYS).toEqual(['suppliers']);
    });
    
    it('has correct API_ENDPOINTS', () => {
        expect(API_ENDPOINTS.LIST).toBe('/api/suppliers');
        expect(API_ENDPOINTS.GET('1')).toBe('/api/suppliers/1');
        expect(API_ENDPOINTS.DELETE('1')).toBe('/api/suppliers/1');
    });
    
    it('has correct SEARCH_KEY', () => {
        expect(SEARCH_KEY).toBe('name');
    });
});

describe('createInitialState', () => {
    it('creates initial state', () => {
        const result = createInitialState();
        expect(result.open).toBe(false);
        expect(result.editingSupplier).toBeUndefined();
        expect(result.deleteOpen).toBe(false);
        expect(result.supplierToDelete).toBeUndefined();
        expect(result.deleteLoading).toBe(false);
    });
});

describe('createEmptySupplier', () => {
    it('creates empty supplier', () => {
        const result = createEmptySupplier();
        expect(result.id).toBe('');
        expect(result.name).toBe('');
        expect(result.email).toBeNull();
        expect(result.phone).toBeNull();
        expect(result.address).toBeNull();
    });
});

describe('createEmptyDialogState', () => {
    it('creates empty dialog state', () => {
        const result = createEmptyDialogState();
        expect(result.open).toBe(false);
        expect(result.editingSupplier).toBeUndefined();
    });
});

describe('setDialogOpen', () => {
    it('sets dialog open', () => {
        const state = createInitialState();
        const result = setDialogOpen(state, true);
        expect(result.open).toBe(true);
    });
});

describe('setEditingSupplier', () => {
    it('sets editing supplier', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const state = createInitialState();
        const result = setEditingSupplier(state, supplier);
        expect(result.editingSupplier).toEqual(supplier);
    });
    
    it('clears editing supplier', () => {
        const state = { ...createInitialState(), editingSupplier: { id: '1', name: 'Supplier A' } };
        const result = setEditingSupplier(state, undefined);
        expect(result.editingSupplier).toBeUndefined();
    });
});

describe('openNewSupplierDialog', () => {
    it('opens dialog for new supplier', () => {
        const state = { ...createInitialState(), open: true, editingSupplier: { id: '1', name: 'Supplier A' } };
        const result = openNewSupplierDialog(state);
        expect(result.open).toBe(true);
        expect(result.editingSupplier).toBeUndefined();
    });
});

describe('openEditDialog', () => {
    it('opens dialog for edit', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const state = createInitialState();
        const result = openEditDialog(state, supplier);
        expect(result.open).toBe(true);
        expect(result.editingSupplier).toEqual(supplier);
    });
});

describe('closeDialog', () => {
    it('closes dialog', () => {
        const state = { ...createInitialState(), open: true, editingSupplier: { id: '1', name: 'Supplier A' } };
        const result = closeDialog(state);
        expect(result.open).toBe(false);
        expect(result.editingSupplier).toBeUndefined();
    });
});

describe('setDeleteOpen', () => {
    it('sets delete dialog open', () => {
        const state = createInitialState();
        const result = setDeleteOpen(state, true);
        expect(result.deleteOpen).toBe(true);
    });
});

describe('setSupplierToDelete', () => {
    it('sets supplier to delete', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const state = createInitialState();
        const result = setSupplierToDelete(state, supplier);
        expect(result.supplierToDelete).toEqual(supplier);
    });
});

describe('openDeleteConfirmation', () => {
    it('opens delete confirmation', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const state = createInitialState();
        const result = openDeleteConfirmation(state, supplier);
        expect(result.deleteOpen).toBe(true);
        expect(result.supplierToDelete).toEqual(supplier);
    });
});

describe('closeDeleteConfirmation', () => {
    it('closes delete confirmation', () => {
        const state = {
            ...createInitialState(),
            deleteOpen: true,
            supplierToDelete: { id: '1', name: 'Supplier A' } as Supplier
        };
        const result = closeDeleteConfirmation(state);
        expect(result.deleteOpen).toBe(false);
        expect(result.supplierToDelete).toBeUndefined();
    });
});

describe('setDeleteLoading', () => {
    it('sets delete loading', () => {
        const state = createInitialState();
        const result = setDeleteLoading(state, true);
        expect(result.deleteLoading).toBe(true);
    });
});

describe('resetState', () => {
    it('resets to initial', () => {

        const result = resetState();
        expect(result).toEqual(createInitialState());
    });
});

describe('buildListUrl', () => {
    it('returns list URL', () => {
        expect(buildListUrl()).toBe('/api/suppliers');
    });
});

describe('buildDeleteUrl', () => {
    it('returns delete URL', () => {
        expect(buildDeleteUrl('1')).toBe('/api/suppliers/1');
    });
});

describe('isDeleteSuccess', () => {
    it('returns true for success', () => {
        expect(isDeleteSuccess({ success: true })).toBe(true);
    });
    
    it('returns false for failure', () => {
        expect(isDeleteSuccess({ success: false })).toBe(false);
    });
});

describe('parseSupplierList', () => {
    it('parses array', () => {
        const json = [{ id: '1', name: 'Supplier A' }];
        expect(parseSupplierList(json)).toEqual(json);
    });
    
    it('parses object with suppliers key', () => {
        const json = { suppliers: [{ id: '1', name: 'Supplier A' }] };
        expect(parseSupplierList(json)).toEqual([{ id: '1', name: 'Supplier A' }]);
    });
    
    it('returns empty for null', () => {
        expect(parseSupplierList(null)).toEqual([]);
    });
});

describe('getErrorMessage', () => {
    it('returns error message', () => {
        expect(getErrorMessage({ success: false, error: 'Error' })).toBe('Error');
    });
    
    it('returns default message', () => {
        expect(getErrorMessage({ success: false })).toBe('Terjadi kesalahan');
    });
});

describe('validateDelete', () => {
    it('returns valid for supplier with ID', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const result = validateDelete(supplier);
        expect(result.valid).toBe(true);
    });
    
    it('returns invalid for undefined', () => {
        const result = validateDelete(undefined);
        expect(result.valid).toBe(false);
    });
});

describe('canDelete', () => {
    it('returns true for valid supplier', () => {
        expect(canDelete({ id: '1', name: 'Supplier A' })).toBe(true);
    });
    
    it('returns false for undefined', () => {
        expect(canDelete(undefined)).toBe(false);
    });
});

describe('formatSupplierDisplay', () => {
    it('formats supplier', () => {
        const supplier: Supplier = {
            id: '1',
            name: 'Supplier A',
            email: 'email@test.com',
            phone: '08123456789',
            address: 'Jl. Jakarta',
            updatedAt: '2025-01-15'
        };
        const result = formatSupplierDisplay(supplier);
        expect(result['Nama']).toBe('Supplier A');
        expect(result['Email']).toBe('email@test.com');
        expect(result['Telepon']).toBe('08123456789');
    });
    
    it('handles null values', () => {
        const supplier: Supplier = { id: '1', name: 'Supplier A' };
        const result = formatSupplierDisplay(supplier);
        expect(result['Email']).toBe('-');
        expect(result['Telepon']).toBe('-');
    });
});

describe('getSupplierSummary', () => {
    it('returns summary', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'A', email: 'a@test.com', phone: '0812' },
            { id: '2', name: 'B', isDeleted: true },
            { id: '3', name: 'C' }
        ];
        const result = getSupplierSummary(suppliers);
        expect(result).toContain('Total: 3');
        expect(result).toContain('Aktif: 2');
        expect(result).toContain('Ada Email: 1');
    });
});

describe('formatContact', () => {
    it('formats contact', () => {
        const contact: SupplierContact = { email: 'a@test.com', phone: '0812' };
        const result = formatContact(contact);
        expect(result.email).toBe('a@test.com');
        expect(result.phone).toBe('0812');
    });
    
    it('handles null', () => {
        const contact: SupplierContact = { email: null, phone: null };
        const result = formatContact(contact);
        expect(result.email).toBe('-');
        expect(result.phone).toBe('-');
    });
});

describe('formatEmail', () => {
    it('returns email', () => {
        expect(formatEmail('a@test.com')).toBe('a@test.com');
    });
    
    it('returns dash for null', () => {
        expect(formatEmail(null)).toBe('-');
    });
});

describe('formatSupplierPhone', () => {
    it('returns phone', () => {
        expect(formatSupplierPhone('08123456789')).toBe('08123456789');
    });
    
    it('returns dash for null', () => {
        expect(formatSupplierPhone(null)).toBe('-');
    });
});

describe('formatSupplierAddress', () => {
    it('returns address', () => {
        expect(formatSupplierAddress('Jl. Jakarta')).toBe('Jl. Jakarta');
    });
    
    it('returns dash for null', () => {
        expect(formatSupplierAddress(null)).toBe('-');
    });
});

describe('getContactDisplay', () => {
    it('returns formatted contact', () => {
        const result = getContactDisplay('a@test.com', '0812');
        expect(result.email).toBe('a@test.com');
        expect(result.phone).toBe('0812');
    });
    
    it('handles null values', () => {
        const result = getContactDisplay(null, null);
        expect(result.email).toBe('-');
        expect(result.phone).toBe('-');
    });
});

describe('hasSupplierChanged', () => {
    it('detects changes', () => {
        const original: Supplier = { id: '1', name: 'Supplier A', email: 'a@test.com', phone: '0812', address: 'Jl. Jkt' };
        const updated: Partial<Supplier> = { name: 'Supplier B' };
        expect(hasSupplierChanged(original, updated)).toBe(true);
    });
    
    it('detects no changes', () => {
        const original: Supplier = { id: '1', name: 'Supplier A', email: 'a@test.com', phone: '0812', address: 'Jl. Jkt' };
        const updated: Partial<Supplier> = { name: 'Supplier A' };
        expect(hasSupplierChanged(original, updated)).toBe(false);
    });
});

describe('findSupplierById', () => {
    it('finds supplier', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A' },
            { id: '2', name: 'Supplier B' }
        ];
        expect(findSupplierById(suppliers, '2')?.name).toBe('Supplier B');
    });
    
    it('returns undefined for not found', () => {
        const suppliers: Supplier[] = [{ id: '1', name: 'Supplier A' }];
        expect(findSupplierById(suppliers, '3')).toBeUndefined();
    });
});

describe('supplierExists', () => {
    it('returns true if exists', () => {
        const suppliers: Supplier[] = [{ id: '1', name: 'Supplier A' }];
        expect(supplierExists(suppliers, '1')).toBe(true);
    });
    
    it('returns false if not exists', () => {
        const suppliers: Supplier[] = [{ id: '1', name: 'Supplier A' }];
        expect(supplierExists(suppliers, '2')).toBe(false);
    });
});

describe('isDuplicateName', () => {
    it('detects duplicate', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A' },
            { id: '2', name: 'Supplier B' }
        ];
        expect(isDuplicateName(suppliers, 'Supplier A')).toBe(true);
    });
    
    it('ignores case', () => {
        const suppliers: Supplier[] = [{ id: '1', name: 'Supplier A' }];
        expect(isDuplicateName(suppliers, 'supplier a')).toBe(true);
    });
    
    it('excludes current ID', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A' },
            { id: '2', name: 'Supplier A' }
        ];
        expect(isDuplicateName(suppliers, 'Supplier A', '1')).toBe(true);
        expect(isDuplicateName(suppliers, 'Supplier A', '3')).toBe(true);
    });
});

describe('filterBySupplierName', () => {
    it('filters by search term', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A' },
            { id: '2', name: 'Supplier B' }
        ];
        expect(filterBySupplierName(suppliers, 'supplier a').length).toBe(1);
    });
    
    it('returns all for empty search', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A' },
            { id: '2', name: 'Supplier B' }
        ];
        expect(filterBySupplierName(suppliers, '').length).toBe(2);
    });
});

describe('filterActiveSuppliers', () => {
    it('filters active suppliers', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A', isDeleted: false },
            { id: '2', name: 'Supplier B', isDeleted: true }
        ];
        expect(filterActiveSuppliers(suppliers).length).toBe(1);
    });
});

describe('getSuppliersWithEmail', () => {
    it('returns suppliers with email', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'A', email: 'a@test.com' },
            { id: '2', name: 'B', email: null }
        ];
        expect(getSuppliersWithEmail(suppliers).length).toBe(1);
    });
});

describe('getSuppliersWithPhone', () => {
    it('returns suppliers with phone', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'A', phone: '0812' },
            { id: '2', name: 'B', phone: null }
        ];
        expect(getSuppliersWithPhone(suppliers).length).toBe(1);
    });
});

describe('sortBySupplierName', () => {
    it('sorts ascending', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Zebra' },
            { id: '2', name: 'Apple' },
            { id: '3', name: 'Banana' }
        ];
        const result = sortBySupplierName(suppliers, 'asc');
        expect(result[0].name).toBe('Apple');
        expect(result[1].name).toBe('Banana');
        expect(result[2].name).toBe('Zebra');
    });
});

describe('sortBySupplierDate', () => {
    it('sorts by date descending', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A', updatedAt: '2025-01-15' },
            { id: '2', name: 'Supplier B', updatedAt: '2025-01-20' }
        ];
        const result = sortBySupplierDate(suppliers, 'desc');
        expect(result[0].name).toBe('Supplier B');
    });
});

describe('prepareSuppliersExport', () => {
    it('prepares export', () => {
        const suppliers: Supplier[] = [
            { id: '1', name: 'Supplier A', email: 'a@test.com', phone: '0812', address: 'Jl. Jkt', updatedAt: '2025-01-15' }
        ];
        const result = prepareSuppliersExport(suppliers);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('Supplier A');
    });
});

describe('getSupplierTableColumnsConfig', () => {
    it('returns config', () => {
        const result = getSupplierTableColumnsConfig();
        expect(result.searchKey).toBe('name');
        expect(result.columns).toContain('Nama');
    });
});

describe('getSupplierDialogTitle', () => {
    it('returns correct title', () => {
        expect(getSupplierDialogTitle(false)).toBe('Tambah Supplier');
        expect(getSupplierDialogTitle(true)).toBe('Edit Supplier');
    });
});

describe('getSupplierDeleteConfirmationMessage', () => {
    it('returns message', () => {
        expect(getSupplierDeleteConfirmationMessage({ id: '1', name: 'Supplier A' })).toContain('Supplier A');
    });
});

describe('SUPPLIER_SUCCESS_MESSAGES', () => {
    it('has all messages', () => {
        expect(SUPPLIER_SUCCESS_MESSAGES.DELETE).toBe('Supplier berhasil dihapus');
        expect(SUPPLIER_SUCCESS_MESSAGES.CREATE).toBe('Supplier berhasil ditambahkan');
    });
});

describe('SUPPLIER_ERROR_MESSAGES', () => {
    it('has all messages', () => {
        expect(SUPPLIER_ERROR_MESSAGES.DELETE).toBe('Gagal menghapus supplier');
        expect(SUPPLIER_ERROR_MESSAGES.FETCH).toBe('Gagal memuat data supplier');
    });
});
