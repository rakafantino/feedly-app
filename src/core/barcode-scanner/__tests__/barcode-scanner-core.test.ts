import { createInitialState, setScanning, resetState, getDefaultConfig } from '../barcode-scanner-core';

describe('barcode-scanner-core', () => {
    it('createInitialState', () => {
        expect(createInitialState().isScanning).toBe(false);
        expect(createInitialState().hasError).toBe(false);
    });
    
    it('setScanning', () => {
        const state = createInitialState();
        expect(setScanning(state, true).isScanning).toBe(true);
    });
    
    
    it('resetState', () => {

        expect(resetState()).toEqual(createInitialState());
    });
    
    it('getDefaultConfig', () => {
        const config = getDefaultConfig();
        expect(config.facingMode).toBe('environment');
    });
});
