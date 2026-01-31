// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id?: string;
  name: string;
  email: string;
  role: string;
  storeId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UserValidation {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UserState {
  open: boolean;
  saving: boolean;
  isEditMode: boolean;
}

export interface UserApiResponse {
  success: boolean;
  data?: User;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export function getRoles(): Record<string, string> {
  return {
    OWNER: 'Pemilik Toko',
    CASHIER: 'Kasir',
  };
}

export function getEditableRoles(): string[] {
  return [ 'CASHIER' ];
}

export function getDefaultRole(): string {
  return 'CASHIER';
}

export const PASSWORD_MIN_LENGTH = 6;
export const NAME_MIN_LENGTH = 2;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial form values
 * Pure function - no side effects
 */
export function createInitialFormValues(): UserFormData {
  return {
    name: '',
    email: '',
    password: '',
    role: getDefaultRole()
  };
}

/**
 * Create initial state
 * Pure function - no side effects
 */
export function createInitialState(isEditMode: boolean = false): UserState {
  return {
    open: false,
    saving: false,
    isEditMode
  };
}

/**
 * Create empty validation errors
 * Pure function - no side effects
 */
export function createEmptyValidationErrors(): UserValidation {
  return {
    name: '',
    email: '',
    password: '',
    role: ''
  };
}

/**
 * Create form values from user data
 * Pure function - no side effects
 */
export function createFormValuesFromUser(user: User | null): UserFormData {
  if (!user) {
    return createInitialFormValues();
  }
  
  return {
    name: user.name || '',
    email: user.email || '',
    password: '', // Don't show password
    role: user.role || getDefaultRole()
  };
}

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform form data to API payload
 * Pure function - no side effects
 */
export function transformToApiPayload(data: UserFormData, isEditMode: boolean): Record<string, unknown> {
  // If edit mode and password is empty, don't include password
  if (isEditMode && !data.password) {
    return {
      name: data.name,
      email: data.email,
      role: data.role
    };
  }
  
  return {
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role
  };
}

/**
 * Transform API response to user data
 * Pure function - no side effects
 */
export function transformApiResponseToUser(response: UserApiResponse): User | null {
  if (!response.success || !response.data) {
    return null;
  }
  return response.data;
}

/**
 * Transform user for display
 * Pure function - no side effects
 */
export function transformUserForDisplay(user: User): Record<string, string> {
  const roles = getRoles();
  
  return {
    'Nama': user.name || '-',
    'Email': user.email || '-',
    'Role': roles[user.role] || user.role || '-',
    'Toko': user.storeId || 'Semua Toko'
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
    return { valid: false, error: 'Nama wajib diisi' };
  }
  if (value.trim().length < NAME_MIN_LENGTH) {
    return { valid: false, error: `Nama minimal ${NAME_MIN_LENGTH} karakter` };
  }
  return { valid: true };
}

/**
 * Validate email
 * Pure function - no side effects
 */
export function validateEmail(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: false, error: 'Email wajib diisi' };
  }
  if (!EMAIL_REGEX.test(value)) {
    return { valid: false, error: 'Email tidak valid' };
  }
  return { valid: true };
}

/**
 * Validate password
 * Pure function - no side effects
 */
export function validatePassword(value: string, isEditMode: boolean = false): { valid: boolean; error?: string } {
  // Password is optional for edit mode
  if (isEditMode && !value) {
    return { valid: true };
  }
  
  if (!value) {
    return { valid: false, error: 'Password wajib diisi' };
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password minimal ${PASSWORD_MIN_LENGTH} karakter` };
  }
  return { valid: true };
}

/**
 * Validate role
 * Pure function - no side effects
 */
export function validateRole(value: string): { valid: boolean; error?: string } {
  const roles = Object.keys(getRoles());
  if (!roles.includes(value)) {
    return { valid: false, error: 'Role tidak valid' };
  }
  return { valid: true };
}

/**
 * Validate all form fields
 * Pure function - no side effects
 */
export function validateForm(data: UserFormData, isEditMode: boolean = false): UserValidation {
  const errors: UserValidation = createEmptyValidationErrors();
  
  const nameResult = validateName(data.name);
  if (!nameResult.valid) errors.name = nameResult.error || '';
  
  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) errors.email = emailResult.error || '';
  
  const passwordResult = validatePassword(data.password, isEditMode);
  if (!passwordResult.valid) errors.password = passwordResult.error || '';
  
  const roleResult = validateRole(data.role);
  if (!roleResult.valid) errors.role = roleResult.error || '';
  
  return errors;
}

/**
 * Check if form is valid
 * Pure function - no side effects
 */
export function isFormValid(errors: UserValidation): boolean {
  return Object.values(errors).every(error => !error);
}

/**
 * Check if form has changes (dirty check)
 * Pure function - no side effects
 */
export function hasFormChanges(original: UserFormData, current: UserFormData): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if email changed
 * Pure function - no side effects
 */
export function hasEmailChanged(original: User | null, current: UserFormData): boolean {
  if (!original) return true;
  return original.email !== current.email;
}

/**
 * Check if role changed
 * Pure function - no side effects
 */
export function hasRoleChanged(original: User | null, current: UserFormData): boolean {
  if (!original) return false;
  return original.role !== current.role;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Get role display label
 * Pure function - no side effects
 */
export function getRoleLabel(role: string): string {
  const labels = getRoles();
  return labels[role] || role;
}

/**
 * Format user summary
 * Pure function - no side effects
 */
export function formatUserSummary(user: UserFormData): string {
  return `${user.name} (${user.email}) - ${getRoleLabel(user.role)}`;
}

/**
 * Truncate name for display
 * Pure function - no side effects
 */
export function truncateName(name: string, maxLength: number = 30): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set open state
 * Pure function - no side effects
 */
export function setOpenState(current: UserState, open: boolean): UserState {
  return { ...current, open };
}

/**
 * Set saving state
 * Pure function - no side effects
 */
export function setSavingState(current: UserState, saving: boolean): UserState {
  return { ...current, saving };
}

/**
 * Reset state
 * Pure function - no side effects
 */
export function resetState(): UserState {
  return createInitialState();
}

/**
 * Toggle dialog
 * Pure function - no side effects
 */
export function toggleDialog(current: UserState): UserState {
  return { ...current, open: !current.open };
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Build API URL
 * Pure function - no side effects
 */
export function buildApiUrl(user: User | null): { url: string; method: string } {
  if (user?.id) {
    return { url: `/api/users/${user.id}`, method: 'PATCH' };
  }
  return { url: '/api/users', method: 'POST' };
}

/**
 * Check if API call was successful
 * Pure function - no side effects
 */
export function isApiSuccess(response: UserApiResponse): boolean {
  return response.success === true;
}

/**
 * Get error message from API response
 * Pure function - no side effects
 */
export function getApiErrorMessage(response: UserApiResponse): string {
  return response.error || 'Terjadi kesalahan';
}

/**
 * Parse API response
 * Pure function - no side effects
 */
export function parseApiResponse(json: unknown): UserApiResponse {
  return json as UserApiResponse;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare user for export
 * Pure function - no side effects
 */
export function prepareUserExport(users: User[]): Array<Record<string, string>> {
  return users.map(user => ({
    'Nama': user.name,
    'Email': user.email,
    'Role': getRoleLabel(user.role),
    'Status': user.isDeleted ? 'Tidak Aktif' : 'Aktif'
  }));
}

/**
 * Get users summary
 * Pure function - no side effects
 */
export function getUsersSummary(users: User[]): string {
  const total = users.length;
  const active = users.filter(u => !u.isDeleted).length;
  const cashiers = users.filter(u => u.role === 'CASHIER').length;
  
  return `Total: ${total} | Aktif: ${active} | Kasir: ${cashiers}`;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

/**
 * Should show password field
 * Pure function - no side effects
 */
export function shouldShowPassword(isEditMode: boolean, hasChanges: boolean): boolean {
  // Show password when creating new user or when explicitly changing
  return !isEditMode || hasChanges;
}

/**
 * Get dialog title
 * Pure function - no side effects
 */
export function getDialogTitle(isEditMode: boolean): string {
  return isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna Baru';
}

/**
 * Get dialog description
 * Pure function - no side effects
 */
export function getDialogDescription(isEditMode: boolean): string {
  return isEditMode 
    ? 'Ubah data pengguna yang sudah ada. Kosongkan password jika tidak ingin mengganti.'
    : 'Masukkan detail untuk membuat akun pengguna baru.';
}

/**
 * Get submit button text
 * Pure function - no side effects
 */
export function getSubmitButtonText(isEditMode: boolean, saving: boolean): string {
  if (saving) return 'Menyimpan...';
  return isEditMode ? 'Simpan Perubahan' : 'Tambah Pengguna';
}

/**
 * Get success message
 * Pure function - no side effects
 */
export function getSuccessMessage(isEditMode: boolean): string {
  return isEditMode 
    ? 'Pengguna berhasil diperbarui' 
    : 'Pengguna berhasil ditambahkan';
}
