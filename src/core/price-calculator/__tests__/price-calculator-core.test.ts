/**
 * TDD Tests for price-calculator-core.ts
 */

import {
    // Constants
    DEFAULT_COSTS,
    DEFAULT_SAFETY_MARGIN,
    DEFAULT_RETAIL_MARGIN,
    DEFAULT_MIN_PRICE_ROUNDING,
    DEFAULT_FINAL_PRICE_ROUNDING,
    DEFAULT_CONFIG,
    
    // Initialization
    createInitialState,
    createDefaultCostItem,
    createEmptyCosts,
    
    // Calculations
    calculateTotalCost,
    calculateHpp,
    calculateSafetyProfit,
    calculateRawMinPrice,
    roundPrice,
    calculateMinSellingPrice,
    calculateRetailProfit,
    calculateFinalSellingPrice,
    calculateTotalProfit,
    calculatePrices,
    
    // State Management
    addCostItem,
    updateCostItem,
    removeCostItem,
    setSafetyMargin,
    setRetailMargin,
    resetState,
    updateCosts,
    
    // Validation
    validateCostItem,
    validateMargin,
    validateMargins,
    validateCalculation,
    
    // Formatting
    formatCurrency,
    formatPercentage,
    formatPrice,
    formatProfit,
    
    // Comparison
    hasPricesChanged,
    hasCostsChanged,
    hasMarginsChanged,
    
    // Export
    prepareCalculationExport,
    getCalculationSummary,
    calculateProfitMargin,
    isProfitable,
    getProfitStatus
} from '../price-calculator-core';
import { CostItem, PriceCalculationResult, PriceCalculatorState } from '../price-calculator-core';

describe('Constants', () => {
    it('has correct defaults', () => {
        expect(DEFAULT_SAFETY_MARGIN).toBe(5);
        expect(DEFAULT_RETAIL_MARGIN).toBe(10);
        expect(DEFAULT_MIN_PRICE_ROUNDING).toBe(50);
        expect(DEFAULT_FINAL_PRICE_ROUNDING).toBe(100);
    });
    
    it('has default costs', () => {
        expect(DEFAULT_COSTS.length).toBe(1);
        expect(DEFAULT_COSTS[0].name).toBe('Plastik/Kemasan');
    });
});

describe('createInitialState', () => {
    it('creates default state', () => {
        const result = createInitialState();
        expect(result.costs.length).toBe(1);
        expect(result.safetyMarginPercent).toBe('5');
        expect(result.retailMarginPercent).toBe('10');
    });
    
    it('uses initial data', () => {
        const initialData = {
            costs: [{ id: '1', name: 'Test', amount: 100 }],
            safetyMargin: 10,
            retailMargin: 15
        };
        const result = createInitialState(initialData);
        expect(result.costs.length).toBe(1);
        expect(result.safetyMarginPercent).toBe('10');
        expect(result.retailMarginPercent).toBe('15');
    });
});

describe('createDefaultCostItem', () => {
    it('creates cost item with default values', () => {
        const result = createDefaultCostItem();
        expect(result.id).toBeDefined();
        expect(result.name).toBe('');
        expect(result.amount).toBe(0);
    });
});

describe('createEmptyCosts', () => {
    it('creates empty array', () => {
        const result = createEmptyCosts();
        expect(result).toEqual([]);
    });
});

describe('calculateTotalCost', () => {
    it('calculates total cost', () => {
        const costs: CostItem[] = [
            { id: '1', name: 'Plastik', amount: 500 },
            { id: '2', name: 'Label', amount: 300 }
        ];
        expect(calculateTotalCost(costs)).toBe(800);
    });
    
    it('handles empty array', () => {
        expect(calculateTotalCost([])).toBe(0);
    });
    
    it('handles null amounts', () => {
        const costs: CostItem[] = [
            { id: '1', name: 'Plastik', amount: 500 },
            { id: '2', name: 'Label', amount: null as any }
        ];
        expect(calculateTotalCost(costs)).toBe(500);
    });
});

describe('calculateHpp', () => {
    it('calculates HPP', () => {
        expect(calculateHpp(10000, 500)).toBe(10500);
    });
    
    it('handles zero additional cost', () => {
        expect(calculateHpp(10000, 0)).toBe(10000);
    });
});

describe('calculateSafetyProfit', () => {
    it('calculates safety profit', () => {
        expect(calculateSafetyProfit(10000, 10)).toBe(1000);
    });
    
    it('calculates zero profit for zero margin', () => {
        expect(calculateSafetyProfit(10000, 0)).toBe(0);
    });
});

describe('calculateRawMinPrice', () => {
    it('calculates raw minimum price', () => {
        expect(calculateRawMinPrice(10000, 1000)).toBe(11000);
    });
});

describe('roundPrice', () => {
    it('rounds up to nearest 50', () => {
        expect(roundPrice(10234, 50)).toBe(10250);
    });
    
    it('rounds up to nearest 100', () => {
        expect(roundPrice(10234, 100)).toBe(10300);
    });
    
    it('handles exact multiple', () => {
        expect(roundPrice(10000, 50)).toBe(10000);
    });
    
    it('handles zero', () => {
        expect(roundPrice(0, 50)).toBe(0);
    });
});

describe('calculateMinSellingPrice', () => {
    it('calculates minimum selling price', () => {
        const result = calculateMinSellingPrice(10000, 10, 50);
        expect(result.price).toBe(11000);
        expect(result.profit).toBe(1000);
    });
    
    it('applies rounding', () => {
        const result = calculateMinSellingPrice(10001, 10, 50);
        expect(result.price).toBe(11050);
    });
});

describe('calculateRetailProfit', () => {
    it('calculates retail profit', () => {
        expect(calculateRetailProfit(11000, 10)).toBe(1100);
    });
});

describe('calculateFinalSellingPrice', () => {
    it('calculates final selling price', () => {
        const result = calculateFinalSellingPrice(11000, 10, 100);
        expect(result.price).toBe(12100);
        expect(result.profit).toBe(1100);
    });
});

describe('calculateTotalProfit', () => {
    it('calculates total profit', () => {
        expect(calculateTotalProfit(12100, 10000)).toBe(2100);
    });
});

describe('calculatePrices', () => {
    it('calculates all prices', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: 500 }];
        const result = calculatePrices(10000, costs, '10', '10', DEFAULT_CONFIG);
        
        expect(result.hpp).toBe(10500);
        // 10500 + 10% = 11550 (rounded to 50 = 11550)
        expect(result.minSellingPrice).toBe(11550);
        // 11550 + 10% = 12705 (rounded to 100 = 12800)
        expect(result.finalSellingPrice).toBe(12800);
        expect(result.safetyProfit).toBe(1050);
        expect(result.retailMargin).toBe(10);
    });
    
    it('handles invalid margins', () => {
        const costs: CostItem[] = [];
        const result = calculatePrices(10000, costs, 'abc', '10', DEFAULT_CONFIG);
        expect(result.safetyMargin).toBe(0);
    });
});

describe('addCostItem', () => {
    it('adds cost item', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: 100 }];
        const result = addCostItem(costs);
        expect(result.length).toBe(2);
        expect(result[1].name).toBe('');
    });
});

describe('updateCostItem', () => {
    it('updates cost item field', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: 100 }];
        const result = updateCostItem(costs, '1', 'name', 'Updated');
        expect(result[0].name).toBe('Updated');
    });
    
    it('updates amount', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: 100 }];
        const result = updateCostItem(costs, '1', 'amount', 200);
        expect(result[0].amount).toBe(200);
    });
});

describe('removeCostItem', () => {
    it('removes cost item', () => {
        const costs: CostItem[] = [
            { id: '1', name: 'Test1', amount: 100 },
            { id: '2', name: 'Test2', amount: 200 }
        ];
        const result = removeCostItem(costs, '1');
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('2');
    });
});

describe('setSafetyMargin', () => {
    it('updates safety margin', () => {
        const state = createInitialState();
        const result = setSafetyMargin(state, '15');
        expect(result.safetyMarginPercent).toBe('15');
    });
});

describe('setRetailMargin', () => {
    it('updates retail margin', () => {
        const state = createInitialState();
        const result = setRetailMargin(state, '20');
        expect(result.retailMarginPercent).toBe('20');
    });
});

describe('resetState', () => {
    it('resets to initial', () => {
        const state: PriceCalculatorState = {
            costs: [{ id: '1', name: 'Test', amount: 100 }],
            safetyMarginPercent: '20',
            retailMarginPercent: '30'
        };
        const result = resetState();
        expect(result.costs.length).toBe(1);
        expect(result.safetyMarginPercent).toBe('5');
    });
});

describe('updateCosts', () => {
    it('updates costs', () => {
        const state = createInitialState();
        const newCosts: CostItem[] = [{ id: '1', name: 'New', amount: 500 }];
        const result = updateCosts(state, newCosts);
        expect(result.costs[0].name).toBe('New');
    });
});

describe('validateCostItem', () => {
    it('returns valid for positive amount', () => {
        const result = validateCostItem({ id: '1', name: 'Test', amount: 100 });
        expect(result.valid).toBe(true);
    });
    
    it('returns valid for zero amount', () => {
        const result = validateCostItem({ id: '1', name: 'Test', amount: 0 });
        expect(result.valid).toBe(true);
    });
    
    it('returns error for negative amount', () => {
        const result = validateCostItem({ id: '1', name: 'Test', amount: -100 });
        expect(result.valid).toBe(false);
    });
});

describe('validateMargin', () => {
    it('returns valid for valid margin', () => {
        const result = validateMargin('10');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for negative', () => {
        const result = validateMargin('-5');
        expect(result.valid).toBe(false);
    });
    
    it('returns error for over 100', () => {
        const result = validateMargin('150');
        expect(result.valid).toBe(false);
    });
    
    it('returns error for non-number', () => {
        const result = validateMargin('abc');
        expect(result.valid).toBe(false);
    });
});

describe('validateMargins', () => {
    it('returns valid for valid margins', () => {
        const result = validateMargins('10', '15');
        expect(result.valid).toBe(true);
    });
    
    it('returns errors for invalid margins', () => {
        const result = validateMargins('-5', '150');
        expect(result.valid).toBe(false);
        expect(Object.keys(result.errors).length).toBe(2);
    });
});

describe('validateCalculation', () => {
    it('returns valid for valid calculation', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: 100 }];
        const result = validateCalculation(10000, costs, '10', '15');
        expect(result.valid).toBe(true);
    });
    
    it('returns error for negative purchase price', () => {
        const costs: CostItem[] = [];
        const result = validateCalculation(-1000, costs, '10', '15');
        expect(result.valid).toBe(false);
    });
    
    it('returns errors for invalid costs', () => {
        const costs: CostItem[] = [{ id: '1', name: 'Test', amount: -100 }];
        const result = validateCalculation(10000, costs, '10', '15');
        expect(result.valid).toBe(false);
    });
});

describe('formatCurrency', () => {
    it('formats number', () => {
        expect(formatCurrency(10000)).toBe('10.000');
    });
    
    it('formats zero', () => {
        expect(formatCurrency(0)).toBe('0');
    });
});

describe('formatPercentage', () => {
    it('formats percentage', () => {
        expect(formatPercentage(10)).toBe('10%');
    });
});

describe('formatPrice', () => {
    it('formats price', () => {
        expect(formatPrice(10000)).toBe('Rp 10.000');
    });
});

describe('formatProfit', () => {
    it('formats profit', () => {
        expect(formatProfit(1000)).toBe('Rp 1.000');
    });
});

describe('hasPricesChanged', () => {
    it('detects changes', () => {
        const original: PriceCalculationResult = {
            hpp: 10000, minSellingPrice: 11000, finalSellingPrice: 12100,
            safetyProfit: 1000, totalProfit: 2100, costs: [], safetyMargin: 10, retailMargin: 10
        };
        const current: PriceCalculationResult = {
            hpp: 10000, minSellingPrice: 11500, finalSellingPrice: 12650,
            safetyProfit: 1500, totalProfit: 2650, costs: [], safetyMargin: 15, retailMargin: 15
        };
        expect(hasPricesChanged(original, current)).toBe(true);
    });
    
    it('detects no changes', () => {
        const original: PriceCalculationResult = {
            hpp: 10000, minSellingPrice: 11000, finalSellingPrice: 12100,
            safetyProfit: 1000, totalProfit: 2100, costs: [], safetyMargin: 10, retailMargin: 10
        };
        const current = { ...original };
        expect(hasPricesChanged(original, current)).toBe(false);
    });
});

describe('hasCostsChanged', () => {
    it('detects changes', () => {
        const original: CostItem[] = [{ id: '1', name: 'A', amount: 100 }];
        const current: CostItem[] = [{ id: '1', name: 'B', amount: 100 }];
        expect(hasCostsChanged(original, current)).toBe(true);
    });
    
    it('detects length changes', () => {
        const original: CostItem[] = [{ id: '1', name: 'A', amount: 100 }];
        const current: CostItem[] = [];
        expect(hasCostsChanged(original, current)).toBe(true);
    });
});

describe('hasMarginsChanged', () => {
    it('detects changes', () => {
        const original: PriceCalculatorState = createInitialState();
        const current: PriceCalculatorState = { ...original, safetyMarginPercent: '15' };
        expect(hasMarginsChanged(original, current)).toBe(true);
    });
});

describe('prepareCalculationExport', () => {
    it('prepares export data', () => {
        const result: PriceCalculationResult = {
            hpp: 10000, minSellingPrice: 11000, finalSellingPrice: 12100,
            safetyProfit: 1000, totalProfit: 2100, costs: [], safetyMargin: 10, retailMargin: 10
        };
        const exportData = prepareCalculationExport(result);
        expect(exportData.length).toBe(1);
        expect(exportData[0]['HPP (Modal Bersih)']).toBe('Rp 10.000');
        expect(exportData[0]['Harga Minimum']).toBe('Rp 11.000');
    });
});

describe('getCalculationSummary', () => {
    it('returns summary', () => {
        const result: PriceCalculationResult = {
            hpp: 10000, minSellingPrice: 11000, finalSellingPrice: 12100,
            safetyProfit: 1000, totalProfit: 2100, costs: [], safetyMargin: 10, retailMargin: 10
        };
        const summary = getCalculationSummary(result);
        expect(summary).toContain('10.000');
        expect(summary).toContain('11.000');
        expect(summary).toContain('12.100');
    });
});

describe('calculateProfitMargin', () => {
    it('calculates profit margin', () => {
        expect(calculateProfitMargin(2000, 10000)).toBe(20);
    });
    
    it('returns zero for zero hpp', () => {
        expect(calculateProfitMargin(1000, 0)).toBe(0);
    });
});

describe('isProfitable', () => {
    it('returns true for profit', () => {
        expect(isProfitable(12100, 10000)).toBe(true);
    });
    
    it('returns false for loss', () => {
        expect(isProfitable(9000, 10000)).toBe(false);
    });
    
    it('returns false for break-even', () => {
        expect(isProfitable(10000, 10000)).toBe(false);
    });
});

describe('getProfitStatus', () => {
    it('returns profit', () => {
        expect(getProfitStatus(12100, 10000)).toBe('profit');
    });
    
    it('returns break-even', () => {
        expect(getProfitStatus(10000, 10000)).toBe('break-even');
    });
    
    it('returns loss', () => {
        expect(getProfitStatus(9000, 10000)).toBe('loss');
    });
});
