// ============================================================================
// TYPES
// ============================================================================

export interface BarcodeInputProps {
    onSubmit: (barcode: string) => void;
    onScanClick?: () => void;
    placeholder?: string;
}

export interface BarcodeInputState {
    value: string;
    isScanning: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PLACEHOLDER = 'Scan atau ketik barcode...';
export const BARCODE_MAX_LENGTH = 50;

// ============================================================================
// INITIALIZATION
// ============================================================================

export function createInitialState(): BarcodeInputState {
    return { value: '', isScanning: false };
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateBarcode(value: string): { valid: boolean; error?: string } {
    if (!value.trim()) {
        return { valid: false, error: 'Barcode wajib diisi' };
    }
    if (value.length > BARCODE_MAX_LENGTH) {
        return { valid: false, error: `Barcode maksimal ${BARCODE_MAX_LENGTH} karakter` };
    }
    return { valid: true };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatBarcode(value: string): string {
    return value.trim();
}

export function isEmptyBarcode(value: string): boolean {
    return value.trim().length === 0;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export function setValue(current: BarcodeInputState, value: string): BarcodeInputState {
    return { ...current, value };
}

export function setScanning(current: BarcodeInputState, isScanning: boolean): BarcodeInputState {
    return { ...current, isScanning };
}

export function clearValue(current: BarcodeInputState): BarcodeInputState {
    return { ...current, value: '' };
}

export function toggleScanning(current: BarcodeInputState): BarcodeInputState {
    return { ...current, isScanning: !current.isScanning };
}

export function resetState(): BarcodeInputState {
    return createInitialState();
}

// ============================================================================
// COMPARISON
// ============================================================================

export function hasValueChanged(original: string, current: string): boolean {
    return original.trim() !== current.trim();
}
