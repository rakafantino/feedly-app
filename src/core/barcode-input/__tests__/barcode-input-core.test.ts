/**
 * Tests for barcode-input-core.ts
 */

import {
    DEFAULT_PLACEHOLDER,
    BARCODE_MAX_LENGTH,
    createInitialState,
    validateBarcode,
    formatBarcode,
    isEmptyBarcode,
    setValue,
    setScanning,
    clearValue,
    toggleScanning,
    resetState,
    hasValueChanged
} from '../barcode-input-core';

describe('Constants', () => {
    it('has correct DEFAULT_PLACEHOLDER', () => {
        expect(DEFAULT_PLACEHOLDER).toBe('Scan atau ketik barcode...');
    });
    
    it('has correct BARCODE_MAX_LENGTH', () => {
        expect(BARCODE_MAX_LENGTH).toBe(50);
    });
});

describe('createInitialState', () => {
    it('creates initial state', () => {
        const result = createInitialState();
        expect(result.value).toBe('');
        expect(result.isScanning).toBe(false);
    });
});

describe('validateBarcode', () => {
    it('validates valid barcode', () => {
        const result = validateBarcode('123456789');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for empty', () => {
        const result = validateBarcode('');
        expect(result.valid).toBe(false);
    });
    
    it('returns error for too long', () => {
        const long = 'a'.repeat(BARCODE_MAX_LENGTH + 1);
        const result = validateBarcode(long);
        expect(result.valid).toBe(false);
    });
});

describe('formatBarcode', () => {
    it('trims whitespace', () => {
        expect(formatBarcode('  123456  ')).toBe('123456');
    });
});

describe('isEmptyBarcode', () => {
    it('returns true for empty', () => {
        expect(isEmptyBarcode('')).toBe(true);
    });
    
    it('returns true for whitespace', () => {
        expect(isEmptyBarcode('   ')).toBe(true);
    });
    
    it('returns false for valid barcode', () => {
        expect(isEmptyBarcode('123456')).toBe(false);
    });
});

describe('setValue', () => {
    it('sets value', () => {
        const state = createInitialState();
        const result = setValue(state, '123456');
        expect(result.value).toBe('123456');
    });
});

describe('setScanning', () => {
    it('sets scanning state', () => {
        const state = createInitialState();
        const result = setScanning(state, true);
        expect(result.isScanning).toBe(true);
    });
});

describe('clearValue', () => {
    it('clears value', () => {
        const state = { value: '123456', isScanning: false };
        const result = clearValue(state);
        expect(result.value).toBe('');
    });
});

describe('toggleScanning', () => {
    it('toggles scanning', () => {
        const state = createInitialState();
        const result = toggleScanning(state);
        expect(result.isScanning).toBe(true);
        
        const result2 = toggleScanning(result);
        expect(result2.isScanning).toBe(false);
    });
});

describe('resetState', () => {
    it('resets to initial', () => {
        const state = { value: '123456', isScanning: true };
        const result = resetState();
        expect(result).toEqual(createInitialState());
    });
});

describe('hasValueChanged', () => {
    it('detects change', () => {
        expect(hasValueChanged('123', '456')).toBe(true);
    });
    
    it('detects no change', () => {
        expect(hasValueChanged('123', '123')).toBe(false);
    });
    
    it('ignores whitespace', () => {
        expect(hasValueChanged('123', '  123  ')).toBe(false);
    });
});
