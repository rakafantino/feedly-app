/**
 * TDD Tests for customer-client-core.ts
 */

import {
    // Constants
    QUERY_KEYS,
    API_ENDPOINTS,
    DEFAULT_PAGE_SIZE,
    SEARCH_KEY,
    
    // Initialization
    createInitialState,
    createEmptyCustomer,
    createInitialDeleteConfirmation,
    createEmptyDialogState,
    
    // State Management
    setDialogOpen,
    setEditingCustomer,
    openNewCustomerDialog,
    openEditDialog,
    closeDialog,
    setDeleteOpen,
    setCustomerToDelete,
    openDeleteConfirmation,
    closeDeleteConfirmation,
    setDeleteLoading,
    resetState,
    
    // API Helpers
    buildListUrl,
    buildDeleteUrl,
    isDeleteSuccess,
    parseCustomerList,
    getErrorMessage,
    
    // Validation
    validateDelete,
    canDelete,
    
    // Formatting
    formatCustomerDisplay,
    getCustomerSummary,
    formatPhone,
    formatAddress,
    
    // Comparison
    hasCustomerChanged,
    findCustomerById,
    customerExists,
    
    // Filtering
    filterByName,
    filterActiveCustomers,
    getCustomersWithPhone,
    
    // Sorting
    sortByName,
    sortByDate,
    
    // Export
    prepareCustomersExport,
    getTableColumnsConfig,
    getDialogTitle,
    getDeleteConfirmationMessage,
    SUCCESS_MESSAGES,
    ERROR_MESSAGES
} from '../customer-client-core';
import { Customer, CustomerState, CustomerApiResponse, DeleteConfirmation } from '../customer-client-core';

describe('Constants', () => {
    it('has correct QUERY_KEYS', () => {
        expect(QUERY_KEYS).toEqual(['customers']);
    });
    
    it('has correct API_ENDPOINTS', () => {
        expect(API_ENDPOINTS.LIST).toBe('/api/customers');
        expect(API_ENDPOINTS.GET('1')).toBe('/api/customers/1');
        expect(API_ENDPOINTS.DELETE('1')).toBe('/api/customers/1');
    });
    
    it('has correct DEFAULT_PAGE_SIZE', () => {
        expect(DEFAULT_PAGE_SIZE).toBe(10);
    });
    
    it('has correct SEARCH_KEY', () => {
        expect(SEARCH_KEY).toBe('name');
    });
});

describe('createInitialState', () => {
    it('creates initial state', () => {
        const result = createInitialState();
        expect(result.open).toBe(false);
        expect(result.editingCustomer).toBeNull();
        expect(result.deleteOpen).toBe(false);
        expect(result.customerToDelete).toBeUndefined();
        expect(result.deleteLoading).toBe(false);
    });
});

describe('createEmptyCustomer', () => {
    it('creates empty customer', () => {
        const result = createEmptyCustomer();
        expect(result.id).toBe('');
        expect(result.name).toBe('');
        expect(result.phone).toBeNull();
        expect(result.address).toBeNull();
    });
});

describe('createInitialDeleteConfirmation', () => {
    it('creates initial delete confirmation', () => {
        const result = createInitialDeleteConfirmation();
        expect(result.isOpen).toBe(false);
        expect(result.customer).toBeUndefined();
        expect(result.loading).toBe(false);
    });
});

describe('createEmptyDialogState', () => {
    it('creates empty dialog state', () => {
        const result = createEmptyDialogState();
        expect(result.open).toBe(false);
        expect(result.editingCustomer).toBeNull();
    });
});

describe('setDialogOpen', () => {
    it('sets dialog open', () => {
        const state = createInitialState();
        const result = setDialogOpen(state, true);
        expect(result.open).toBe(true);
    });
    
    it('sets dialog closed', () => {
        const state = { ...createInitialState(), open: true };
        const result = setDialogOpen(state, false);
        expect(result.open).toBe(false);
    });
});

describe('setEditingCustomer', () => {
    it('sets editing customer', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const state = createInitialState();
        const result = setEditingCustomer(state, customer);
        expect(result.editingCustomer).toEqual(customer);
    });
    
    it('clears editing customer', () => {
        const state = { ...createInitialState(), editingCustomer: { id: '1', name: 'John' } };
        const result = setEditingCustomer(state, null);
        expect(result.editingCustomer).toBeNull();
    });
});

describe('openNewCustomerDialog', () => {
    it('opens dialog for new customer', () => {
        const state = { ...createInitialState(), open: true, editingCustomer: { id: '1', name: 'John' } };
        const result = openNewCustomerDialog(state);
        expect(result.open).toBe(true);
        expect(result.editingCustomer).toBeNull();
    });
});

describe('openEditDialog', () => {
    it('opens dialog for edit', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const state = createInitialState();
        const result = openEditDialog(state, customer);
        expect(result.open).toBe(true);
        expect(result.editingCustomer).toEqual(customer);
    });
});

describe('closeDialog', () => {
    it('closes dialog', () => {
        const state = { ...createInitialState(), open: true, editingCustomer: { id: '1', name: 'John' } };
        const result = closeDialog(state);
        expect(result.open).toBe(false);
        expect(result.editingCustomer).toBeNull();
    });
});

describe('setDeleteOpen', () => {
    it('sets delete dialog open', () => {
        const state = createInitialState();
        const result = setDeleteOpen(state, true);
        expect(result.deleteOpen).toBe(true);
    });
});

describe('setCustomerToDelete', () => {
    it('sets customer to delete', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const state = createInitialState();
        const result = setCustomerToDelete(state, customer);
        expect(result.customerToDelete).toEqual(customer);
    });
});

describe('openDeleteConfirmation', () => {
    it('opens delete confirmation', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const state = createInitialState();
        const result = openDeleteConfirmation(state, customer);
        expect(result.deleteOpen).toBe(true);
        expect(result.customerToDelete).toEqual(customer);
    });
});

describe('closeDeleteConfirmation', () => {
    it('closes delete confirmation', () => {
        const state = {
            ...createInitialState(),
            deleteOpen: true,
            customerToDelete: { id: '1', name: 'John' } as Customer
        };
        const result = closeDeleteConfirmation(state);
        expect(result.deleteOpen).toBe(false);
        expect(result.customerToDelete).toBeUndefined();
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
        const state: CustomerState = {
            open: true,
            editingCustomer: { id: '1', name: 'John' },
            deleteOpen: true,
            customerToDelete: { id: '1', name: 'John' },
            deleteLoading: true
        };
        const result = resetState();
        expect(result).toEqual(createInitialState());
    });
});

describe('buildListUrl', () => {
    it('returns list URL', () => {
        expect(buildListUrl()).toBe('/api/customers');
    });
});

describe('buildDeleteUrl', () => {
    it('returns delete URL', () => {
        expect(buildDeleteUrl('1')).toBe('/api/customers/1');
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

describe('parseCustomerList', () => {
    it('parses array', () => {
        const json = [{ id: '1', name: 'John' }];
        expect(parseCustomerList(json)).toEqual(json);
    });
    
    it('parses object with customers key', () => {
        const json = { customers: [{ id: '1', name: 'John' }] };
        expect(parseCustomerList(json)).toEqual([{ id: '1', name: 'John' }]);
    });
    
    it('returns empty for invalid', () => {
        expect(parseCustomerList(null)).toEqual([]);
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
    it('returns valid for customer with ID', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const result = validateDelete(customer);
        expect(result.valid).toBe(true);
    });
    
    it('returns invalid for undefined', () => {
        const result = validateDelete(undefined);
        expect(result.valid).toBe(false);
    });
    
    it('returns invalid for customer without ID', () => {
        const customer = { id: '', name: 'John' } as Customer;
        const result = validateDelete(customer);
        expect(result.valid).toBe(false);
    });
});

describe('canDelete', () => {
    it('returns true for valid customer', () => {
        expect(canDelete({ id: '1', name: 'John' })).toBe(true);
    });
    
    it('returns false for undefined', () => {
        expect(canDelete(undefined)).toBe(false);
    });
});

describe('formatCustomerDisplay', () => {
    it('formats customer', () => {
        const customer: Customer = {
            id: '1',
            name: 'John Doe',
            phone: '08123456789',
            address: 'Jl. Jakarta',
            createdAt: '2025-01-15'
        };
        const result = formatCustomerDisplay(customer);
        expect(result['Nama']).toBe('John Doe');
        expect(result['Telepon']).toBe('08123456789');
        expect(result['Alamat']).toBe('Jl. Jakarta');
    });
    
    it('handles null values', () => {
        const customer: Customer = { id: '1', name: 'John' };
        const result = formatCustomerDisplay(customer);
        expect(result['Telepon']).toBe('-');
        expect(result['Alamat']).toBe('-');
    });
});

describe('getCustomerSummary', () => {
    it('returns summary', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', phone: '0812' },
            { id: '2', name: 'Jane', isDeleted: true, phone: '0899' },
            { id: '3', name: 'Bob' }
        ];
        const result = getCustomerSummary(customers);
        expect(result).toContain('Total: 3');
        expect(result).toContain('Aktif: 2');
        expect(result).toContain('Ada Telepon: 2');
    });
});

describe('formatPhone', () => {
    it('returns phone', () => {
        expect(formatPhone('08123456789')).toBe('08123456789');
    });
    
    it('returns dash for null', () => {
        expect(formatPhone(null)).toBe('-');
    });
    
    it('returns dash for undefined', () => {
        expect(formatPhone(undefined)).toBe('-');
    });
});

describe('formatAddress', () => {
    it('returns address', () => {
        expect(formatAddress('Jl. Jakarta')).toBe('Jl. Jakarta');
    });
    
    it('returns dash for null', () => {
        expect(formatAddress(null)).toBe('-');
    });
});

describe('hasCustomerChanged', () => {
    it('detects changes', () => {
        const original: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const updated: Partial<Customer> = { name: 'Jane' };
        expect(hasCustomerChanged(original, updated)).toBe(true);
    });
    
    it('detects no changes', () => {
        const original: Customer = { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt' };
        const updated: Partial<Customer> = { name: 'John' };
        expect(hasCustomerChanged(original, updated)).toBe(false);
    });
});

describe('findCustomerById', () => {
    it('finds customer', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' }
        ];
        expect(findCustomerById(customers, '2')?.name).toBe('Jane');
    });
    
    it('returns undefined for not found', () => {
        const customers: Customer[] = [{ id: '1', name: 'John' }];
        expect(findCustomerById(customers, '3')).toBeUndefined();
    });
});

describe('customerExists', () => {
    it('returns true if exists', () => {
        const customers: Customer[] = [{ id: '1', name: 'John' }];
        expect(customerExists(customers, '1')).toBe(true);
    });
    
    it('returns false if not exists', () => {
        const customers: Customer[] = [{ id: '1', name: 'John' }];
        expect(customerExists(customers, '2')).toBe(false);
    });
});

describe('filterByName', () => {
    it('filters by search term', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John Doe' },
            { id: '2', name: 'Jane Smith' }
        ];
        expect(filterByName(customers, 'john').length).toBe(1);
    });
    
    it('returns all for empty search', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' }
        ];
        expect(filterByName(customers, '').length).toBe(2);
    });
});

describe('filterActiveCustomers', () => {
    it('filters active customers', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', isDeleted: false },
            { id: '2', name: 'Jane', isDeleted: true }
        ];
        expect(filterActiveCustomers(customers).length).toBe(1);
    });
});

describe('getCustomersWithPhone', () => {
    it('returns customers with phone', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', phone: '0812' },
            { id: '2', name: 'Jane', phone: null }
        ];
        expect(getCustomersWithPhone(customers).length).toBe(1);
    });
});

describe('sortByName', () => {
    it('sorts ascending', () => {
        const customers: Customer[] = [
            { id: '1', name: 'Zebra' },
            { id: '2', name: 'Apple' },
            { id: '3', name: 'Banana' }
        ];
        const result = sortByName(customers, 'asc');
        expect(result[0].name).toBe('Apple');
        expect(result[1].name).toBe('Banana');
        expect(result[2].name).toBe('Zebra');
    });
    
    it('sorts descending', () => {
        const customers: Customer[] = [
            { id: '1', name: 'Zebra' },
            { id: '2', name: 'Apple' }
        ];
        const result = sortByName(customers, 'desc');
        expect(result[0].name).toBe('Zebra');
    });
});

describe('sortByDate', () => {
    it('sorts by date descending', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', createdAt: '2025-01-15' },
            { id: '2', name: 'Jane', createdAt: '2025-01-20' }
        ];
        const result = sortByDate(customers, 'desc');
        expect(result[0].name).toBe('Jane');
    });
    
    it('sorts by date ascending', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', createdAt: '2025-01-15' },
            { id: '2', name: 'Jane', createdAt: '2025-01-20' }
        ];
        const result = sortByDate(customers, 'asc');
        expect(result[0].name).toBe('John');
    });
});

describe('prepareCustomersExport', () => {
    it('prepares export', () => {
        const customers: Customer[] = [
            { id: '1', name: 'John', phone: '0812', address: 'Jl. Jkt', createdAt: '2025-01-15' }
        ];
        const result = prepareCustomersExport(customers);
        expect(result.length).toBe(1);
        expect(result[0]['Nama']).toBe('John');
    });
});

describe('getTableColumnsConfig', () => {
    it('returns config', () => {
        const result = getTableColumnsConfig();
        expect(result.searchKey).toBe('name');
        expect(result.columns).toContain('Nama');
    });
});

describe('getDialogTitle', () => {
    it('returns correct title', () => {
        expect(getDialogTitle(false)).toBe('Tambah Pelanggan');
        expect(getDialogTitle(true)).toBe('Edit Pelanggan');
    });
});

describe('getDeleteConfirmationMessage', () => {
    it('returns message', () => {
        expect(getDeleteConfirmationMessage({ id: '1', name: 'John' })).toContain('John');
    });
});

describe('SUCCESS_MESSAGES', () => {
    it('has all messages', () => {
        expect(SUCCESS_MESSAGES.DELETE).toBe('Pelanggan berhasil dihapus');
        expect(SUCCESS_MESSAGES.CREATE).toBe('Pelanggan berhasil ditambahkan');
        expect(SUCCESS_MESSAGES.UPDATE).toBe('Pelanggan berhasil diperbarui');
    });
});

describe('ERROR_MESSAGES', () => {
    it('has all messages', () => {
        expect(ERROR_MESSAGES.DELETE).toBe('Gagal menghapus pelanggan');
        expect(ERROR_MESSAGES.FETCH).toBe('Gagal memuat data pelanggan');
    });
});
