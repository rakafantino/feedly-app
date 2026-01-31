/**
 * TDD Tests for user-form-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Constants
  getRoles,
  getEditableRoles,
  getDefaultRole,
  
  // Initialization
  createInitialFormValues,
  createInitialState,
  createEmptyValidationErrors,
  createFormValuesFromUser,
  
  // Transformation
  transformToApiPayload,
  transformApiResponseToUser,
  
  // Validation
  validateName,
  validateEmail,
  validatePassword,
  validateRole,
  validateForm,
  isFormValid,
  hasFormChanges,
  
  // Comparison
  hasEmailChanged,
  hasRoleChanged,
  
  // Formatting
  getRoleLabel,
  formatUserSummary,
  truncateName,
  
  // State Management
  setOpenState,
  setSavingState,
  resetState,
  toggleDialog,
  
  // API Helpers
  buildApiUrl,
  isApiSuccess,
  getApiErrorMessage,
  parseApiResponse,
  
  // Export
  prepareUserExport,
  getUsersSummary,
  
  // Export Helpers
  shouldShowPassword,
  getDialogTitle,
  getDialogDescription,
  getSubmitButtonText,
  getSuccessMessage,
  
  // Types
  User,
  UserFormData,
  UserApiResponse,
  UserState
} from '../user-form-core';

describe('getRoles', () => {
  it('returns all roles', () => {
    const result = getRoles();
    expect(result.OWNER).toBe('Pemilik Toko');
    expect(result.CASHIER).toBe('Kasir');
  });
});

describe('getEditableRoles', () => {
  it('returns editable roles', () => {
    const result = getEditableRoles();
    expect(result).toContain('CASHIER');
    expect(result).not.toContain('OWNER');
  });
});

describe('getDefaultRole', () => {
  it('returns CASHIER', () => {
    expect(getDefaultRole()).toBe('CASHIER');
  });
});

describe('createInitialFormValues', () => {
  it('creates empty form values', () => {
    const result = createInitialFormValues();
    expect(result.name).toBe('');
    expect(result.email).toBe('');
    expect(result.password).toBe('');
    expect(result.role).toBe('CASHIER');
  });
});

describe('createInitialState', () => {
  it('creates default state', () => {
    const result = createInitialState(false);
    expect(result.open).toBe(false);
    expect(result.saving).toBe(false);
    expect(result.isEditMode).toBe(false);
  });
  
  it('creates edit mode state', () => {
    const result = createInitialState(true);
    expect(result.isEditMode).toBe(true);
  });
});

describe('createEmptyValidationErrors', () => {
  it('creates empty errors', () => {
    const result = createEmptyValidationErrors();
    expect(result.name).toBe('');
    expect(result.email).toBe('');
    expect(result.password).toBe('');
    expect(result.role).toBe('');
  });
});

describe('createFormValuesFromUser', () => {
  it('creates from user data', () => {
    const user: User = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CASHIER'
    };
    const result = createFormValuesFromUser(user);
    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
    expect(result.role).toBe('CASHIER');
    expect(result.password).toBe(''); // Password should be empty
  });
  
  it('creates empty for null user', () => {
    const result = createFormValuesFromUser(null);
    expect(result.name).toBe('');
    expect(result.role).toBe('CASHIER');
  });
});

describe('transformToApiPayload', () => {
  it('includes password for new user', () => {
    const data: UserFormData = {
      name: 'John',
      email: 'john@example.com',
      password: 'password123',
      role: 'CASHIER'
    };
    const result = transformToApiPayload(data, false);
    expect(result.name).toBe('John');
    expect(result.password).toBe('password123');
  });
  
  it('excludes password for edit when empty', () => {
    const data: UserFormData = {
      name: 'John',
      email: 'john@example.com',
      password: '',
      role: 'CASHIER'
    };
    const result = transformToApiPayload(data, true);
    expect(result.password).toBeUndefined();
  });
  
  it('includes password for edit when provided', () => {
    const data: UserFormData = {
      name: 'John',
      email: 'john@example.com',
      password: 'newpassword',
      role: 'CASHIER'
    };
    const result = transformToApiPayload(data, true);
    expect(result.password).toBe('newpassword');
  });
});

describe('transformApiResponseToUser', () => {
  it('returns user for success response', () => {
    const user: User = { id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' };
    const response: UserApiResponse = { success: true, data: user };
    expect(transformApiResponseToUser(response)).toEqual(user);
  });
  
  it('returns null for failed response', () => {
    const response: UserApiResponse = { success: false, error: 'Error' };
    expect(transformApiResponseToUser(response)).toBeNull();
  });
});

describe('validateName', () => {
  it('returns error for empty', () => {
    const result = validateName('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('wajib diisi');
  });
  
  it('returns error for too short', () => {
    const result = validateName('J');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('minimal 2 karakter');
  });
  
  it('returns valid for proper name', () => {
    const result = validateName('John Doe');
    expect(result.valid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('returns error for empty', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
  });
  
  it('returns error for invalid format', () => {
    const result = validateEmail('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tidak valid');
  });
  
  it('returns valid for proper email', () => {
    const result = validateEmail('john@example.com');
    expect(result.valid).toBe(true);
  });
});

describe('validatePassword', () => {
  it('returns valid for empty in edit mode', () => {
    const result = validatePassword('', true);
    expect(result.valid).toBe(true);
  });
  
  it('returns error for empty in create mode', () => {
    const result = validatePassword('', false);
    expect(result.valid).toBe(false);
  });
  
  it('returns error for too short', () => {
    const result = validatePassword('12345');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('minimal 6 karakter');
  });
  
  it('returns valid for proper password', () => {
    const result = validatePassword('password123');
    expect(result.valid).toBe(true);
  });
});

describe('validateRole', () => {
  it('returns error for invalid role', () => {
    const result = validateRole('INVALID');
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for valid role', () => {
    const result = validateRole('CASHIER');
    expect(result.valid).toBe(true);
  });
});

describe('validateForm', () => {
  it('returns errors for invalid form', () => {
    const data: UserFormData = {
      name: '',
      email: 'invalid',
      password: '',
      role: 'INVALID'
    };
    const errors = validateForm(data, false);
    expect(errors.name).toContain('wajib diisi');
    expect(errors.email).toContain('tidak valid');
  });
  
  it('returns empty for valid form', () => {
    const data: UserFormData = {
      name: 'John',
      email: 'john@example.com',
      password: 'password123',
      role: 'CASHIER'
    };
    const errors = validateForm(data, false);
    expect(isFormValid(errors)).toBe(true);
  });
  
  it('allows empty password in edit mode', () => {
    const data: UserFormData = {
      name: 'John',
      email: 'john@example.com',
      password: '',
      role: 'CASHIER'
    };
    const errors = validateForm(data, true);
    expect(errors.password).toBe('');
  });
});

describe('hasFormChanges', () => {
  it('returns false for same values', () => {
    const original: UserFormData = { name: 'John', email: 'john@example.com', password: '', role: 'CASHIER' };
    const current = { ...original };
    expect(hasFormChanges(original, current)).toBe(false);
  });
  
  it('returns true for different values', () => {
    const original: UserFormData = { name: 'John', email: 'john@example.com', password: '', role: 'CASHIER' };
    const current = { ...original, name: 'Jane' };
    expect(hasFormChanges(original, current)).toBe(true);
  });
});

describe('hasEmailChanged', () => {
  it('returns true for new user', () => {
    expect(hasEmailChanged(null, { name: 'John', email: 'john@example.com', password: '123', role: 'CASHIER' })).toBe(true);
  });
  
  it('detects email change', () => {
    const user: User = { id: '1', name: 'John', email: 'old@example.com', role: 'CASHIER' };
    const form = { name: 'John', email: 'new@example.com', password: '', role: 'CASHIER' };
    expect(hasEmailChanged(user, form)).toBe(true);
  });
});

describe('hasRoleChanged', () => {
  it('returns false for new user', () => {
    expect(hasRoleChanged(null, { name: 'John', email: 'john@example.com', password: '123', role: 'CASHIER' })).toBe(false);
  });
  
  it('detects role change', () => {
    const user: User = { id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' };
    const form = { name: 'John', email: 'john@example.com', password: '', role: 'OWNER' };
    expect(hasRoleChanged(user, form)).toBe(true);
  });
});

describe('getRoleLabel', () => {
  it('returns correct labels', () => {
    expect(getRoleLabel('OWNER')).toBe('Pemilik Toko');
    expect(getRoleLabel('CASHIER')).toBe('Kasir');
    expect(getRoleLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('formatUserSummary', () => {
  it('formats correctly', () => {
    const result = formatUserSummary({
      name: 'John Doe',
      email: 'john@example.com',
      password: '123',
      role: 'CASHIER'
    });
    expect(result).toContain('John Doe');
    expect(result).toContain('john@example.com');
    expect(result).toContain('Kasir');
  });
});

describe('truncateName', () => {
  it('returns original if short', () => {
    expect(truncateName('John', 10)).toBe('John');
  });
  
  it('truncates long names', () => {
    // maxLength 10 = keep 7 chars + "..." = 10 total
    expect(truncateName('John Doe Smith Wilson', 10)).toBe('John Do...');
  });
});

describe('setOpenState', () => {
  it('updates open state', () => {
    const state = createInitialState(false);
    const result = setOpenState(state, true);
    expect(result.open).toBe(true);
  });
});

describe('setSavingState', () => {
  it('updates saving state', () => {
    const state = createInitialState(false);
    const result = setSavingState(state, true);
    expect(result.saving).toBe(true);
  });
});

describe('resetState', () => {
  it('resets to initial', () => {
    // resetState should return to default regardless of input
    const result = resetState();
    expect(result.open).toBe(false);
    expect(result.saving).toBe(false);
    expect(result.isEditMode).toBe(false);
  });
});

describe('toggleDialog', () => {
  it('toggles open state', () => {
    const state: UserState = { open: false, saving: false, isEditMode: false };
    const result = toggleDialog(state);
    expect(result.open).toBe(true);
    
    const result2 = toggleDialog(result);
    expect(result2.open).toBe(false);
  });
});

describe('buildApiUrl', () => {
  it('returns create URL for new user', () => {
    const result = buildApiUrl(null);
    expect(result.url).toBe('/api/users');
    expect(result.method).toBe('POST');
  });
  
  it('returns update URL for existing user', () => {
    const result = buildApiUrl({ id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' });
    expect(result.url).toBe('/api/users/1');
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
    const json = { success: true, data: { id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' } };
    const result = parseApiResponse(json);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('John');
  });
});

describe('prepareUserExport', () => {
  it('prepares data correctly', () => {
    const users: User[] = [
      { id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' },
      { id: '2', name: 'Jane', email: 'jane@example.com', role: 'CASHIER', isDeleted: true }
    ];
    const result = prepareUserExport(users);
    expect(result.length).toBe(2);
    expect(result[0]['Nama']).toBe('John');
    expect(result[0]['Role']).toBe('Kasir');
    expect(result[1]['Status']).toBe('Tidak Aktif');
  });
});

describe('getUsersSummary', () => {
  it('returns summary', () => {
    const users: User[] = [
      { id: '1', name: 'John', email: 'john@example.com', role: 'CASHIER' },
      { id: '2', name: 'Jane', email: 'jane@example.com', role: 'CASHIER', isDeleted: true }
    ];
    const result = getUsersSummary(users);
    expect(result).toContain('Total: 2');
    expect(result).toContain('Aktif: 1');
    expect(result).toContain('Kasir: 2');
  });
});

describe('shouldShowPassword', () => {
  it('shows for new user', () => {
    expect(shouldShowPassword(false, false)).toBe(true);
  });
  
  it('hides for edit without changes', () => {
    expect(shouldShowPassword(true, false)).toBe(false);
  });
  
  it('shows for edit with changes', () => {
    expect(shouldShowPassword(true, true)).toBe(true);
  });
});

describe('getDialogTitle', () => {
  it('returns correct title', () => {
    expect(getDialogTitle(false)).toBe('Tambah Pengguna Baru');
    expect(getDialogTitle(true)).toBe('Edit Pengguna');
  });
});

describe('getDialogDescription', () => {
  it('returns correct description', () => {
    expect(getDialogDescription(false)).toContain('baru');
    expect(getDialogDescription(true)).toContain('mengganti');
  });
});

describe('getSubmitButtonText', () => {
  it('returns saving text', () => {
    expect(getSubmitButtonText(false, true)).toBe('Menyimpan...');
  });
  
  it('returns create text', () => {
    expect(getSubmitButtonText(false, false)).toBe('Tambah Pengguna');
  });
  
  it('returns update text', () => {
    expect(getSubmitButtonText(true, false)).toBe('Simpan Perubahan');
  });
});

describe('getSuccessMessage', () => {
  it('returns correct message', () => {
    expect(getSuccessMessage(false)).toBe('Pengguna berhasil ditambahkan');
    expect(getSuccessMessage(true)).toBe('Pengguna berhasil diperbarui');
  });
});
