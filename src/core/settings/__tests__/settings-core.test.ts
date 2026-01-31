/**
 * TDD Tests for settings-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Initialization
  createInitialSettingsState,
  createDefaultFormValues,
  createEmptyValidationErrors,
  
  // Transformation
  transformToFormValues,
  transformToApiPayload,
  transformToDisplay,
  
  // Validation
  validateName,
  validateEmail,
  validatePhone,
  validateNumber,
  validateExpiryNotificationDays,
  validateStockNotificationInterval,
  validateForm,
  isFormValid,
  
  // Comparison
  isFormDirty,
  hasFieldChanged,
  getChangedFields,
  
  // Formatting
  formatCurrency,
  formatNumber,
  formatDays,
  formatMinutes,
  truncateText,
  formatPhoneNumber,
  
  // Calculations
  calculateDailyAverage,
  calculateWeeklyTarget,
  calculateMonthlyTarget,
  getTargetRecommendations,
  calculateAchievement,
  
  // Default Values
  getDefaultExpiryNotificationDays,
  getDefaultStockNotificationInterval,
  getDefaultTargets,
  getFieldDefault,
  
  // State Management
  setLoadingState,
  setSavingState,
  setDirtyState,
  resetSettingsState,
  
  // Export
  prepareSettingsExport,
  getSettingsSummary,
  isSettingsComplete,
  
  // API Helpers
  buildSettingsUrl,
  parseSettingsResponse,
  isApiSuccess,
  getApiErrorMessage
} from '../settings-core';
import { StoreSettings, SettingsFormData, SettingsValidation } from '../settings-core';

describe('createInitialSettingsState', () => {
  it('creates initial state', () => {
    const result = createInitialSettingsState();
    expect(result.loading).toBe(true);
    expect(result.saving).toBe(false);
    expect(result.dirty).toBe(false);
  });
});

describe('createDefaultFormValues', () => {
  it('creates default values', () => {
    const result = createDefaultFormValues();
    expect(result.name).toBe('');
    expect(result.dailyTarget).toBe(0);
    expect(result.expiryNotificationDays).toBe(30);
    expect(result.stockNotificationInterval).toBe(60);
  });
});

describe('createEmptyValidationErrors', () => {
  it('creates empty errors object', () => {
    const result = createEmptyValidationErrors();
    expect(result.name).toBe('');
    expect(result.email).toBe('');
    expect(Object.values(result).every(v => v === '')).toBe(true);
  });
});

describe('transformToFormValues', () => {
  it('transforms API data to form values', () => {
    const apiData = {
      name: 'Toko Saya',
      description: 'Deskripsi',
      address: 'Jl. Jalan',
      phone: '08123456789',
      email: 'test@example.com',
      dailyTarget: 1000000,
      weeklyTarget: 7000000,
      monthlyTarget: 30000000,
      expiryNotificationDays: 45,
      stockNotificationInterval: 30
    };
    
    const result = transformToFormValues(apiData);
    expect(result.name).toBe('Toko Saya');
    expect(result.expiryNotificationDays).toBe(45);
    expect(result.stockNotificationInterval).toBe(30);
  });
  
  it('handles missing values', () => {
    const result = transformToFormValues({});
    expect(result.name).toBe('');
    expect(result.expiryNotificationDays).toBe(30);
  });
});

describe('transformToApiPayload', () => {
  it('transforms form to API payload', () => {
    const formData: SettingsFormData = {
      name: 'Toko Saya',
      description: 'Test',
      address: '',
      phone: '',
      email: '',
      dailyTarget: 1000000,
      weeklyTarget: 7000000,
      monthlyTarget: 30000000,
      expiryNotificationDays: 30,
      stockNotificationInterval: 60
    };
    
    const result = transformToApiPayload(formData);
    expect(result.name).toBe('Toko Saya');
    expect(result.description).toBe('Test');
    expect(result.address).toBeNull(); // Empty strings become null
    expect(result.expiryNotificationDays).toBe(30);
  });
});

describe('transformToDisplay', () => {
  it('transforms for display', () => {
    const settings: StoreSettings = {
      name: 'Toko Saya',
      email: 'test@example.com',
      dailyTarget: 1000000,
      monthlyTarget: 30000000
    };
    
    const result = transformToDisplay(settings);
    expect(result['Nama Toko']).toBe('Toko Saya');
    expect(result['Email']).toBe('test@example.com');
    expect(result['Target Harian']).toContain('1.000.000');
  });
});

describe('validateName', () => {
  it('returns error for empty', () => {
    const result = validateName('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('wajib diisi');
  });
  
  it('returns error for too short', () => {
    const result = validateName('A');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('minimal 2 karakter');
  });
  
  it('returns valid for proper name', () => {
    const result = validateName('Toko Saya');
    expect(result.valid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('returns valid for empty', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(true);
  });
  
  it('returns error for invalid email', () => {
    const result = validateEmail('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tidak valid');
  });
  
  it('returns valid for proper email', () => {
    const result = validateEmail('test@example.com');
    expect(result.valid).toBe(true);
  });
});

describe('validatePhone', () => {
  it('returns valid for empty', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(true);
  });
  
  it('returns error for invalid phone', () => {
    const result = validatePhone('12');
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for proper phone', () => {
    const result = validatePhone('081234567890');
    expect(result.valid).toBe(true);
  });
});

describe('validateNumber', () => {
  it('returns error for non-number', () => {
    const result = validateNumber('abc');
    expect(result.valid).toBe(false);
  });
  
  it('returns error for negative', () => {
    const result = validateNumber('-10', 0);
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for positive number', () => {
    const result = validateNumber('100', 0);
    expect(result.valid).toBe(true);
  });
});

describe('validateExpiryNotificationDays', () => {
  it('returns error for less than 1', () => {
    const result = validateExpiryNotificationDays(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Minimal 1 hari');
  });
  
  it('returns error for more than 365', () => {
    const result = validateExpiryNotificationDays(400);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maksimal 365');
  });
  
  it('returns valid for proper value', () => {
    const result = validateExpiryNotificationDays(30);
    expect(result.valid).toBe(true);
  });
});

describe('validateStockNotificationInterval', () => {
  it('returns error for less than 5', () => {
    const result = validateStockNotificationInterval(3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Minimal 5 menit');
  });
  
  it('returns error for more than 1440', () => {
    const result = validateStockNotificationInterval(2000);
    expect(result.valid).toBe(false);
  });
  
  it('returns valid for proper value', () => {
    const result = validateStockNotificationInterval(60);
    expect(result.valid).toBe(true);
  });
});

describe('validateForm', () => {
  it('returns errors for invalid form', () => {
    const formData: SettingsFormData = {
      name: '',
      description: '',
      address: '',
      phone: '12', // Invalid
      email: 'invalid', // Invalid
      dailyTarget: 0,
      weeklyTarget: 0,
      monthlyTarget: 0,
      expiryNotificationDays: 0, // Invalid
      stockNotificationInterval: 0 // Invalid
    };
    
    const errors = validateForm(formData);
    expect(errors.name).toContain('wajib diisi');
    expect(errors.email).toContain('tidak valid');
    expect(errors.expiryNotificationDays).toContain('Minimal');
  });
  
  it('returns empty errors for valid form', () => {
    const formData: SettingsFormData = {
      name: 'Toko Saya',
      description: '',
      address: '',
      phone: '',
      email: '',
      dailyTarget: 1000000,
      weeklyTarget: 7000000,
      monthlyTarget: 30000000,
      expiryNotificationDays: 30,
      stockNotificationInterval: 60
    };
    
    const errors = validateForm(formData);
    expect(isFormValid(errors)).toBe(true);
  });
});

describe('isFormValid', () => {
  it('returns false when has errors', () => {
    const errors: SettingsValidation = { ...createEmptyValidationErrors(), name: 'Error' };
    expect(isFormValid(errors)).toBe(false);
  });
  
  it('returns true when no errors', () => {
    expect(isFormValid(createEmptyValidationErrors())).toBe(true);
  });
});

describe('isFormDirty', () => {
  it('returns false for same values', () => {
    const original = createDefaultFormValues();
    const current = createDefaultFormValues();
    expect(isFormDirty(original, current)).toBe(false);
  });
  
  it('returns true for different values', () => {
    const original = createDefaultFormValues();
    const current = { ...createDefaultFormValues(), name: 'Changed' };
    expect(isFormDirty(original, current)).toBe(true);
  });
});

describe('hasFieldChanged', () => {
  it('returns true when changed', () => {
    const original = createDefaultFormValues();
    const current = { ...createDefaultFormValues(), name: 'Changed' };
    expect(hasFieldChanged(original, current, 'name')).toBe(true);
    expect(hasFieldChanged(original, current, 'email')).toBe(false);
  });
});

describe('getChangedFields', () => {
  it('returns changed field names', () => {
    const original = createDefaultFormValues();
    const current = { 
      ...createDefaultFormValues(), 
      name: 'Changed',
      expiryNotificationDays: 45
    };
    const result = getChangedFields(original, current);
    expect(result).toContain('name');
    expect(result).toContain('expiryNotificationDays');
    expect(result.length).toBe(2);
  });
});

describe('formatCurrency', () => {
  it('formats correctly', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('1.000.000');
    expect(result).toContain('Rp');
  });
});

describe('formatNumber', () => {
  it('formats with thousand separator', () => {
    expect(formatNumber(1000000)).toBe('1.000.000');
  });
});

describe('formatDays', () => {
  it('formats days', () => {
    expect(formatDays(30)).toBe('30 hari');
  });
});

describe('formatMinutes', () => {
  it('formats minutes', () => {
    expect(formatMinutes(30)).toBe('30 menit');
  });
  
  it('formats hours', () => {
    expect(formatMinutes(120)).toBe('2 jam');
  });
  
  it('formats mixed hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 jam 30 menit');
  });
});

describe('truncateText', () => {
  it('returns original if shorter', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });
  
  it('truncates and adds ellipsis', () => {
    expect(truncateText('Hello World', 8)).toBe('Hello...');
  });
});

describe('formatPhoneNumber', () => {
  it('returns as is', () => {
    expect(formatPhoneNumber('081234567890')).toBe('081234567890');
  });
});

describe('calculateDailyAverage', () => {
  it('calculates correctly', () => {
    expect(calculateDailyAverage(3000000)).toBe(100000);
  });
});

describe('calculateWeeklyTarget', () => {
  it('calculates correctly', () => {
    expect(calculateWeeklyTarget(30000000)).toBeGreaterThan(6900000);
  });
});

describe('calculateMonthlyTarget', () => {
  it('calculates correctly', () => {
    expect(calculateMonthlyTarget(1000000)).toBe(30000000);
  });
});

describe('getTargetRecommendations', () => {
  it('returns recommendations', () => {
    const result = getTargetRecommendations(30000000);
    expect(result.recommendedDaily).toBeGreaterThan(0);
    expect(result.recommendedMonthly).toBe(30000000);
  });
});

describe('calculateAchievement', () => {
  it('calculates correctly', () => {
    expect(calculateAchievement(15000000, 30000000)).toBe(50);
  });
  
  it('returns correct percentage when actual exceeds target', () => {
    // 40000000 / 30000000 = 1.333... = 133%
    expect(calculateAchievement(40000000, 30000000)).toBe(133);
  });
  
  it('handles zero target', () => {
    expect(calculateAchievement(1000000, 0)).toBe(100);
    expect(calculateAchievement(0, 0)).toBe(0);
  });
});

describe('getDefaultExpiryNotificationDays', () => {
  it('returns 30', () => {
    expect(getDefaultExpiryNotificationDays()).toBe(30);
  });
});

describe('getDefaultStockNotificationInterval', () => {
  it('returns 60', () => {
    expect(getDefaultStockNotificationInterval()).toBe(60);
  });
});

describe('getDefaultTargets', () => {
  it('returns zero targets', () => {
    const result = getDefaultTargets();
    expect(result.daily).toBe(0);
    expect(result.weekly).toBe(0);
    expect(result.monthly).toBe(0);
  });
});

describe('getFieldDefault', () => {
  it('returns correct defaults', () => {
    expect(getFieldDefault('name')).toBe('');
    expect(getFieldDefault('expiryNotificationDays')).toBe(30);
    expect(getFieldDefault('stockNotificationInterval')).toBe(60);
  });
});

describe('setLoadingState', () => {
  it('updates loading state', () => {
    const state = createInitialSettingsState();
    const result = setLoadingState(state, false);
    expect(result.loading).toBe(false);
  });
});

describe('setSavingState', () => {
  it('updates saving state', () => {
    const state = createInitialSettingsState();
    const result = setSavingState(state, true);
    expect(result.saving).toBe(true);
  });
});

describe('setDirtyState', () => {
  it('updates dirty state', () => {
    const state = createInitialSettingsState();
    const result = setDirtyState(state, true);
    expect(result.dirty).toBe(true);
  });
});

describe('resetSettingsState', () => {
  it('resets to initial', () => {
    const result = resetSettingsState();
    expect(result.loading).toBe(true);
    expect(result.saving).toBe(false);
    expect(result.dirty).toBe(false);
  });
});

describe('prepareSettingsExport', () => {
  it('prepares data correctly', () => {
    const settings: StoreSettings = {
      name: 'Toko Saya',
      email: 'test@example.com',
      dailyTarget: 1000000
    };
    const result = prepareSettingsExport(settings);
    expect(result.length).toBe(1);
    expect(result[0]['Nama Toko']).toBe('Toko Saya');
  });
});

describe('getSettingsSummary', () => {
  it('returns summary text', () => {
    const settings: StoreSettings = {
      name: 'Toko Saya',
      email: 'test@example.com',
      phone: '081234567890'
    };
    const result = getSettingsSummary(settings);
    expect(result).toContain('Toko Saya');
    expect(result).toContain('test@example.com');
    expect(result).toContain('081234567890');
  });
});

describe('isSettingsComplete', () => {
  it('returns false for incomplete', () => {
    expect(isSettingsComplete({})).toBe(false);
    expect(isSettingsComplete({ name: '' })).toBe(false);
  });
  
  it('returns true for complete', () => {
    expect(isSettingsComplete({ name: 'Toko Saya' })).toBe(true);
  });
});

describe('buildSettingsUrl', () => {
  it('builds correct URL', () => {
    expect(buildSettingsUrl('settings')).toBe('/api/settings');
  });
});

describe('parseSettingsResponse', () => {
  it('returns null for failed response', () => {
    expect(parseSettingsResponse({ success: false })).toBeNull();
    expect(parseSettingsResponse({ success: true })).toBeNull();
  });
  
  it('returns data for success response', () => {
    const settings: StoreSettings = { name: 'Toko Saya' };
    expect(parseSettingsResponse({ success: true, data: settings })).toEqual(settings);
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
  it('returns message from response', () => {
    expect(getApiErrorMessage({ message: 'Error occurred' })).toBe('Error occurred');
  });
  
  it('returns default message', () => {
    expect(getApiErrorMessage({})).toBe('Terjadi kesalahan');
  });
});
