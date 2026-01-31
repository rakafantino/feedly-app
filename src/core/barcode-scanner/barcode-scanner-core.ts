// Barcode Scanner Core
// Pure functions for barcode scanner state management

export interface ScannerState {
    isScanning: boolean;
    hasError: boolean;
    errorMessage?: string;
}

export interface ScannerConfig {
    facingMode: 'environment' | 'user';
    width: number;
    height: number;
}

export function createInitialState(): ScannerState {
    return { isScanning: false, hasError: false };
}

export function setScanning(current: ScannerState, isScanning: boolean): ScannerState {
    return { ...current, isScanning };
}

export function setError(current: ScannerState, hasError: boolean, message?: string): ScannerState {
    return { ...current, hasError, errorMessage: message };
}

export function resetState(): ScannerState {
    return createInitialState();
}

export function getDefaultConfig(): ScannerConfig {
    return { facingMode: 'environment', width: 1280, height: 720 };
}

export function formatErrorMessage(error: string): string {
    return `Scanner error: ${error}`;
}

export function isCameraAvailable(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
