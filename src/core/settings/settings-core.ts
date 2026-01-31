// ============================================================================
// TYPES
// ============================================================================

export interface StoreSettings {
  name: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  dailyTarget?: number | null;
  weeklyTarget?: number | null;
  monthlyTarget?: number | null;
  expiryNotificationDays?: number | null;
  stockNotificationInterval?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SettingsFormData {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  expiryNotificationDays: number;
  stockNotificationInterval: number;
}

export interface SettingsValidation {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  dailyTarget: string;
  weeklyTarget: string;
  monthlyTarget: string;
  expiryNotificationDays: string;
  stockNotificationInterval: string;
}

export interface SettingsState {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial settings state
 * Pure function - no side effects
 */
export function createInitialSettingsState(): SettingsState {
  return {
    loading: true,
    saving: false,
    dirty: false
  };
}

/**
 * Create default form values
 * Pure function - no side effects
 */
export function createDefaultFormValues(): SettingsFormData {
  return {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    dailyTarget: 0,
    weeklyTarget: 0,
    monthlyTarget: 0,
    expiryNotificationDays: 30,
    stockNotificationInterval: 60
  };
}

/**
 * Create empty validation errors
 * Pure function - no side effects
 */
export function createEmptyValidationErrors(): SettingsValidation {
  return {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    dailyTarget: '',
    weeklyTarget: '',
    monthlyTarget: '',
    expiryNotificationDays: '',
    stockNotificationInterval: ''
  };
}

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform API response to form values
 * Pure function - no side effects
 */
export function transformToFormValues(data: Record<string, unknown>): SettingsFormData {
  return {
    name: String(data.name || ''),
    description: String(data.description || ''),
    address: String(data.address || ''),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    dailyTarget: Number(data.dailyTarget) || 0,
    weeklyTarget: Number(data.weeklyTarget) || 0,
    monthlyTarget: Number(data.monthlyTarget) || 0,
    expiryNotificationDays: Number(data.expiryNotificationDays) || 30,
    stockNotificationInterval: Number(data.stockNotificationInterval) || 60
  };
}

/**
 * Transform form values to API payload
 * Pure function - no side effects
 */
export function transformToApiPayload(data: SettingsFormData): Record<string, unknown> {
  return {
    name: data.name,
    description: data.description || null,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    dailyTarget: data.dailyTarget,
    weeklyTarget: data.weeklyTarget,
    monthlyTarget: data.monthlyTarget,
    expiryNotificationDays: data.expiryNotificationDays,
    stockNotificationInterval: data.stockNotificationInterval
  };
}

/**
 * Transform settings to display format
 * Pure function - no side effects
 */
export function transformToDisplay(settings: StoreSettings): Record<string, string> {
  return {
    'Nama Toko': settings.name || '-',
    'Deskripsi': settings.description || '-',
    'Alamat': settings.address || '-',
    'Telepon': settings.phone || '-',
    'Email': settings.email || '-',
    'Target Harian': settings.dailyTarget?.toLocaleString('id-ID') || '0',
    'Target Mingguan': settings.weeklyTarget?.toLocaleString('id-ID') || '0',
    'Target Bulanan': settings.monthlyTarget?.toLocaleString('id-ID') || '0',
    'Notifikasi Kadaluarsa': `${settings.expiryNotificationDays || 30} hari`,
    'Interval Notifikasi': `${settings.stockNotificationInterval || 60} menit`
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate store name
 * Pure function - no side effects
 */
export function validateName(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: false, error: 'Nama toko wajib diisi' };
  }
  if (value.trim().length < 2) {
    return { valid: false, error: 'Nama toko minimal 2 karakter' };
  }
  return { valid: true };
}

/**
 * Validate email
 * Pure function - no side effects
 */
export function validateEmail(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: true }; // Optional
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { valid: false, error: 'Email tidak valid' };
  }
  return { valid: true };
}

/**
 * Validate phone number
 * Pure function - no side effects
 */
export function validatePhone(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: true }; // Optional
  }
  // Allow various phone formats
  const phoneRegex = /^[0-9+\-\s]{8,15}$/;
  if (!phoneRegex.test(value)) {
    return { valid: false, error: 'Nomor telepon tidak valid' };
  }
  return { valid: true };
}

/**
 * Validate numeric fields
 * Pure function - no side effects
 */
export function validateNumber(value: string, min: number = 0): { valid: boolean; error?: string } {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: 'Wajib berupa angka' };
  }
  if (num < min) {
    return { valid: false, error: `Tidak boleh kurang dari ${min}` };
  }
  return { valid: true };
}

/**
 * Validate expiry notification days
 * Pure function - no side effects
 */
export function validateExpiryNotificationDays(value: number): { valid: boolean; error?: string } {
  if (value < 1) {
    return { valid: false, error: 'Minimal 1 hari' };
  }
  if (value > 365) {
    return { valid: false, error: 'Maksimal 365 hari' };
  }
  return { valid: true };
}

/**
 * Validate stock notification interval
 * Pure function - no side effects
 */
export function validateStockNotificationInterval(value: number): { valid: boolean; error?: string } {
  if (value < 5) {
    return { valid: false, error: 'Minimal 5 menit' };
  }
  if (value > 1440) {
    return { valid: false, error: 'Maksimal 1440 menit (24 jam)' };
  }
  return { valid: true };
}

/**
 * Validate all form fields
 * Pure function - no side effects
 */
export function validateForm(data: SettingsFormData): SettingsValidation {
  const errors: SettingsValidation = createEmptyValidationErrors();
  
  const nameResult = validateName(data.name);
  if (!nameResult.valid) errors.name = nameResult.error || '';
  
  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) errors.email = emailResult.error || '';
  
  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) errors.phone = phoneResult.error || '';
  
  const dailyResult = validateNumber(String(data.dailyTarget));
  if (!dailyResult.valid) errors.dailyTarget = dailyResult.error || '';
  
  const weeklyResult = validateNumber(String(data.weeklyTarget));
  if (!weeklyResult.valid) errors.weeklyTarget = weeklyResult.error || '';
  
  const monthlyResult = validateNumber(String(data.monthlyTarget));
  if (!monthlyResult.valid) errors.monthlyTarget = monthlyResult.error || '';
  
  const expiryResult = validateExpiryNotificationDays(data.expiryNotificationDays);
  if (!expiryResult.valid) errors.expiryNotificationDays = expiryResult.error || '';
  
  const intervalResult = validateStockNotificationInterval(data.stockNotificationInterval);
  if (!intervalResult.valid) errors.stockNotificationInterval = intervalResult.error || '';
  
  return errors;
}

/**
 * Check if form is valid
 * Pure function - no side effects
 */
export function isFormValid(errors: SettingsValidation): boolean {
  return Object.values(errors).every(error => !error);
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if form is dirty (has unsaved changes)
 * Pure function - no side effects
 */
export function isFormDirty(original: SettingsFormData, current: SettingsFormData): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}

/**
 * Check if field has changed
 * Pure function - no side effects
 */
export function hasFieldChanged(original: SettingsFormData, current: SettingsFormData, field: keyof SettingsFormData): boolean {
  return original[field] !== current[field];
}

/**
 * Get changed fields
 * Pure function - no side effects
 */
export function getChangedFields(original: SettingsFormData, current: SettingsFormData): string[] {
  const changed: string[] = [];
  (Object.keys(current) as Array<keyof SettingsFormData>).forEach(key => {
    if (original[key] !== current[key]) {
      changed.push(key);
    }
  });
  return changed;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format currency for display
 * Pure function - no side effects
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format number with thousand separator
 * Pure function - no side effects
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

/**
 * Format days for display
 * Pure function - no side effects
 */
export function formatDays(value: number): string {
  return `${value} hari`;
}

/**
 * Format minutes for display
 * Pure function - no side effects
 */
export function formatMinutes(value: number): string {
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
  }
  return `${value} menit`;
}

/**
 * Truncate text
 * Pure function - no side effects
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format phone number for display
 * Pure function - no side effects
 */
export function formatPhoneNumber(phone: string): string {
  // Keep as is, just validate format
  return phone;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate daily average from monthly target
 * Pure function - no side effects
 */
export function calculateDailyAverage(monthlyTarget: number): number {
  return Math.round(monthlyTarget / 30);
}

/**
 * Calculate weekly target from monthly
 * Pure function - no side effects
 */
export function calculateWeeklyTarget(monthlyTarget: number): number {
  return Math.round(monthlyTarget / 4.33);
}

/**
 * Calculate monthly target from daily
 * Pure function - no side effects
 */
export function calculateMonthlyTarget(dailyTarget: number): number {
  return Math.round(dailyTarget * 30);
}

/**
 * Get target recommendations
 * Pure function - no side effects
 */
export function getTargetRecommendations(currentMonthly: number): {
  recommendedDaily: number;
  recommendedWeekly: number;
  recommendedMonthly: number;
} {
  return {
    recommendedDaily: Math.round(currentMonthly / 30),
    recommendedWeekly: Math.round(currentMonthly / 4.33),
    recommendedMonthly: currentMonthly
  };
}

/**
 * Calculate target achievement percentage
 * Pure function - no side effects
 */
export function calculateAchievement(actual: number, target: number): number {
  if (target === 0) return actual > 0 ? 100 : 0;
  return Math.round((actual / target) * 100);
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Get default expiry notification days
 * Pure function - no side effects
 */
export function getDefaultExpiryNotificationDays(): number {
  return 30;
}

/**
 * Get default stock notification interval
 * Pure function - no side effects
 */
export function getDefaultStockNotificationInterval(): number {
  return 60; // 60 minutes
}

/**
 * Get default targets
 * Pure function - no side effects
 */
export function getDefaultTargets(): {
  daily: number;
  weekly: number;
  monthly: number;
} {
  return {
    daily: 0,
    weekly: 0,
    monthly: 0
  };
}

/**
 * Get field default value
 * Pure function - no side effects
 */
export function getFieldDefault(key: keyof SettingsFormData): unknown {
  const defaults: Record<string, unknown> = {
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    dailyTarget: 0,
    weeklyTarget: 0,
    monthlyTarget: 0,
    expiryNotificationDays: 30,
    stockNotificationInterval: 60
  };
  return defaults[key];
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Set loading state
 * Pure function - no side effects
 */
export function setLoadingState(current: SettingsState, loading: boolean): SettingsState {
  return { ...current, loading };
}

/**
 * Set saving state
 * Pure function - no side effects
 */
export function setSavingState(current: SettingsState, saving: boolean): SettingsState {
  return { ...current, saving };
}

/**
 * Set dirty state
 * Pure function - no side effects
 */
export function setDirtyState(current: SettingsState, dirty: boolean): SettingsState {
  return { ...current, dirty };
}

/**
 * Reset state
 * Pure function - no side effects
 */
export function resetSettingsState(): SettingsState {
  return createInitialSettingsState();
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare settings for export
 * Pure function - no side effects
 */
export function prepareSettingsExport(settings: StoreSettings): Array<Record<string, string>> {
  return [{
    'Nama Toko': settings.name || '-',
    'Email': settings.email || '-',
    'Telepon': settings.phone || '-',
    'Alamat': settings.address || '-',
    'Target Harian': (settings.dailyTarget || 0).toLocaleString('id-ID'),
    'Target Mingguan': (settings.weeklyTarget || 0).toLocaleString('id-ID'),
    'Target Bulanan': (settings.monthlyTarget || 0).toLocaleString('id-ID'),
    'Notifikasi Kadaluarsa': `${settings.expiryNotificationDays || 30} hari`,
    'Interval Notifikasi': `${settings.stockNotificationInterval || 60} menit`
  }];
}

/**
 * Get settings summary
 * Pure function - no side effects
 */
export function getSettingsSummary(settings: StoreSettings): string {
  const parts: string[] = [];
  parts.push(`Toko: ${settings.name || '-'}`);
  if (settings.email) parts.push(`Email: ${settings.email}`);
  if (settings.phone) parts.push(`Telp: ${settings.phone}`);
  return parts.join(' | ');
}

/**
 * Check if settings are complete
 * Pure function - no side effects
 */
export function isSettingsComplete(settings: Partial<StoreSettings>): boolean {
  return !!(
    settings.name &&
    settings.name.length >= 2
  );
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Build API URL for settings
 * Pure function - no side effects
 */
export function buildSettingsUrl(endpoint: string): string {
  return `/api/${endpoint}`;
}

/**
 * Parse API response
 * Pure function - no side effects
 */
export function parseSettingsResponse(response: Record<string, unknown>): StoreSettings | null {
  if (!response.success || !response.data) {
    return null;
  }
  return response.data as StoreSettings;
}

/**
 * Check if API call was successful
 * Pure function - no side effects
 */
export function isApiSuccess(response: Record<string, unknown>): boolean {
  return response.success === true;
}

/**
 * Get API error message
 * Pure function - no side effects
 */
export function getApiErrorMessage(response: Record<string, unknown>): string {
  return String(response.message || 'Terjadi kesalahan');
}
