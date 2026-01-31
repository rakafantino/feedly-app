// ============================================================================
// TYPES
// ============================================================================

export interface CostItem {
    id: string;
    name: string;
    amount: number;
}

export interface PriceCalculationResult {
    hpp: number;
    minSellingPrice: number;
    finalSellingPrice: number;
    safetyProfit: number;
    totalProfit: number;
    costs: CostItem[];
    safetyMargin: number;
    retailMargin: number;
}

export interface PriceCalculatorState {
    costs: CostItem[];
    safetyMarginPercent: string;
    retailMarginPercent: string;
}

export interface PriceCalculatorConfig {
    minPriceRounding: number;
    finalPriceRounding: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_COSTS: CostItem[] = [
    { id: "1", name: "Plastik/Kemasan", amount: 0 }
];

export const DEFAULT_SAFETY_MARGIN = 5; // 5%
export const DEFAULT_RETAIL_MARGIN = 10; // 10%

export const DEFAULT_MIN_PRICE_ROUNDING = 50;
export const DEFAULT_FINAL_PRICE_ROUNDING = 100;

export const DEFAULT_CONFIG: PriceCalculatorConfig = {
    minPriceRounding: DEFAULT_MIN_PRICE_ROUNDING,
    finalPriceRounding: DEFAULT_FINAL_PRICE_ROUNDING
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create initial state
 * Pure function - no side effects
 */
export function createInitialState(initialData?: {
    costs: CostItem[];
    safetyMargin: number;
    retailMargin: number;
}): PriceCalculatorState {
    return {
        costs: initialData?.costs && initialData.costs.length > 0
            ? initialData.costs
            : [...DEFAULT_COSTS],
        safetyMarginPercent: initialData?.safetyMargin?.toString() || DEFAULT_SAFETY_MARGIN.toString(),
        retailMarginPercent: initialData?.retailMargin?.toString() || DEFAULT_RETAIL_MARGIN.toString()
    };
}

/**
 * Create default cost item
 * Pure function - no side effects
 */
export function createDefaultCostItem(): CostItem {
    return { id: Math.random().toString(), name: "", amount: 0 };
}

/**
 * Create empty costs array
 * Pure function - no side effects
 */
export function createEmptyCosts(): CostItem[] {
    return [];
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate total operational cost
 * Pure function - no side effects
 */
export function calculateTotalCost(costs: CostItem[]): number {
    return costs.reduce((sum, item) => sum + (item.amount || 0), 0);
}

/**
 * Calculate HPP (modal bersih)
 * Pure function - no side effects
 */
export function calculateHpp(purchasePrice: number, totalCost: number): number {
    return purchasePrice + totalCost;
}

/**
 * Calculate safety profit
 * Pure function - no side effects
 */
export function calculateSafetyProfit(hpp: number, safetyMarginPercent: number): number {
    return hpp * (safetyMarginPercent / 100);
}

/**
 * Calculate raw minimum selling price
 * Pure function - no side effects
 */
export function calculateRawMinPrice(hpp: number, safetyProfit: number): number {
    return hpp + safetyProfit;
}

/**
 * Round price to nearest value
 * Pure function - no side effects
 */
export function roundPrice(price: number, rounding: number): number {
    return Math.ceil(price / rounding) * rounding;
}

/**
 * Calculate minimum selling price
 * Pure function - no side effects
 */
export function calculateMinSellingPrice(
    hpp: number,
    safetyMarginPercent: number,
    rounding: number = DEFAULT_MIN_PRICE_ROUNDING
): { price: number; profit: number } {
    const safetyProfit = calculateSafetyProfit(hpp, safetyMarginPercent);
    const rawMinPrice = calculateRawMinPrice(hpp, safetyProfit);
    const roundedPrice = roundPrice(rawMinPrice, rounding);
    return { price: roundedPrice, profit: roundedPrice - hpp };
}

/**
 * Calculate retail profit
 * Pure function - no side effects
 */
export function calculateRetailProfit(minPrice: number, retailMarginPercent: number): number {
    return minPrice * (retailMarginPercent / 100);
}

/**
 * Calculate final selling price
 * Pure function - no side effects
 */
export function calculateFinalSellingPrice(
    minPrice: number,
    retailMarginPercent: number,
    rounding: number = DEFAULT_FINAL_PRICE_ROUNDING
): { price: number; profit: number } {
    const retailProfit = calculateRetailProfit(minPrice, retailMarginPercent);
    const rawFinalPrice = minPrice + retailProfit;
    const roundedPrice = roundPrice(rawFinalPrice, rounding);
    return { price: roundedPrice, profit: roundedPrice - minPrice };
}

/**
 * Calculate total profit
 * Pure function - no side effects
 */
export function calculateTotalProfit(finalPrice: number, hpp: number): number {
    return finalPrice - hpp;
}

/**
 * Complete price calculation
 * Pure function - no side effects
 */
export function calculatePrices(
    purchasePrice: number,
    costs: CostItem[],
    safetyMarginPercent: string,
    retailMarginPercent: string,
    config: PriceCalculatorConfig = DEFAULT_CONFIG
): PriceCalculationResult {
    const sMargin = parseFloat(safetyMarginPercent) || 0;
    const rMargin = parseFloat(retailMarginPercent) || 0;
    
    const totalCost = calculateTotalCost(costs);
    const hpp = calculateHpp(purchasePrice, totalCost);
    
    const minResult = calculateMinSellingPrice(hpp, sMargin, config.minPriceRounding);
    const finalResult = calculateFinalSellingPrice(minResult.price, rMargin, config.finalPriceRounding);
    
    return {
        hpp,
        minSellingPrice: minResult.price,
        finalSellingPrice: finalResult.price,
        safetyProfit: minResult.profit,
        totalProfit: finalResult.price - hpp,
        costs,
        safetyMargin: sMargin,
        retailMargin: rMargin
    };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Add cost item
 * Pure function - no side effects
 */
export function addCostItem(costs: CostItem[]): CostItem[] {
    return [...costs, createDefaultCostItem()];
}

/**
 * Update cost item
 * Pure function - no side effects
 */
export function updateCostItem(
    costs: CostItem[],
    id: string,
    field: keyof CostItem,
    value: any
): CostItem[] {
    return costs.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
    );
}

/**
 * Remove cost item
 * Pure function - no side effects
 */
export function removeCostItem(costs: CostItem[], id: string): CostItem[] {
    return costs.filter((item) => item.id !== id);
}

/**
 * Set safety margin
 * Pure function - no side effects
 */
export function setSafetyMargin(state: PriceCalculatorState, margin: string): PriceCalculatorState {
    return { ...state, safetyMarginPercent: margin };
}

/**
 * Set retail margin
 * Pure function - no side effects
 */
export function setRetailMargin(state: PriceCalculatorState, margin: string): PriceCalculatorState {
    return { ...state, retailMarginPercent: margin };
}

/**
 * Reset state
 * Pure function - no side effects
 */
export function resetState(): PriceCalculatorState {
    return createInitialState();
}

/**
 * Update state with new costs
 * Pure function - no side effects
 */
export function updateCosts(state: PriceCalculatorState, costs: CostItem[]): PriceCalculatorState {
    return { ...state, costs };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate cost item
 * Pure function - no side effects
 */
export function validateCostItem(item: CostItem): { valid: boolean; error?: string } {
    if (item.amount < 0) {
        return { valid: false, error: 'Biaya tidak boleh negatif' };
    }
    return { valid: true };
}

/**
 * Validate margin percentage
 * Pure function - no side effects
 */
export function validateMargin(value: string): { valid: boolean; error?: string } {
    const num = parseFloat(value);
    if (isNaN(num)) {
        return { valid: false, error: 'Margin harus berupa angka' };
    }
    if (num < 0) {
        return { valid: false, error: 'Margin tidak boleh negatif' };
    }
    if (num > 100) {
        return { valid: false, error: 'Margin tidak boleh lebih dari 100%' };
    }
    return { valid: true };
}

/**
 * Validate all margins
 * Pure function - no side effects
 */
export function validateMargins(safetyMargin: string, retailMargin: string): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    
    const safetyResult = validateMargin(safetyMargin);
    if (!safetyResult.valid) errors.safetyMargin = safetyResult.error || '';
    
    const retailResult = validateMargin(retailMargin);
    if (!retailResult.valid) errors.retailMargin = retailResult.error || '';
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Validate complete calculation
 * Pure function - no side effects
 */
export function validateCalculation(
    purchasePrice: number,
    costs: CostItem[],
    safetyMargin: string,
    retailMargin: string
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (purchasePrice < 0) {
        errors.push('Harga beli tidak boleh negatif');
    }
    
    costs.forEach((item, index) => {
        const result = validateCostItem(item);
        if (!result.valid) {
            errors.push(`Item ${index + 1}: ${result.error}`);
        }
    });
    
    const marginResult = validateMargins(safetyMargin, retailMargin);
    if (!marginResult.valid) {
        Object.values(marginResult.errors).forEach(e => errors.push(e));
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format currency
 * Pure function - no side effects
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("id-ID").format(value);
}

/**
 * Format percentage
 * Pure function - no side effects
 */
export function formatPercentage(value: number): string {
    return `${value}%`;
}

/**
 * Format price for display
 * Pure function - no side effects
 */
export function formatPrice(value: number): string {
    return `Rp ${formatCurrency(value)}`;
}

/**
 * Format profit for display
 * Pure function - no side effects
 */
export function formatProfit(value: number): string {
    return `Rp ${formatCurrency(value)}`;
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if prices changed
 * Pure function - no side effects
 */
export function hasPricesChanged(
    original: PriceCalculationResult,
    current: PriceCalculationResult
): boolean {
    return (
        original.minSellingPrice !== current.minSellingPrice ||
        original.finalSellingPrice !== current.finalSellingPrice ||
        original.hpp !== current.hpp
    );
}

/**
 * Check if costs changed
 * Pure function - no side effects
 */
export function hasCostsChanged(original: CostItem[], current: CostItem[]): boolean {
    if (original.length !== current.length) return true;
    return JSON.stringify(original) !== JSON.stringify(current);
}

/**
 * Check if margins changed
 * Pure function - no side effects
 */
export function hasMarginsChanged(
    original: PriceCalculatorState,
    current: PriceCalculatorState
): boolean {
    return (
        original.safetyMarginPercent !== current.safetyMarginPercent ||
        original.retailMarginPercent !== current.retailMarginPercent
    );
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare calculation for export
 * Pure function - no side effects
 */
export function prepareCalculationExport(result: PriceCalculationResult): Array<Record<string, string>> {
    return [{
        'HPP (Modal Bersih)': formatPrice(result.hpp),
        'Harga Minimum': formatPrice(result.minSellingPrice),
        'Profit Minimum': formatProfit(result.safetyProfit),
        'Harga Jual Akhir': formatPrice(result.finalSellingPrice),
        'Total Profit': formatProfit(result.totalProfit),
        'Margin Pengaman': formatPercentage(result.safetyMargin),
        'Margin Jual': formatPercentage(result.retailMargin)
    }];
}

/**
 * Get calculation summary
 * Pure function - no side effects
 */
export function getCalculationSummary(result: PriceCalculationResult): string {
    return `HPP: ${formatCurrency(result.hpp)} | Min: ${formatCurrency(result.minSellingPrice)} | Jual: ${formatCurrency(result.finalSellingPrice)}`;
}

/**
 * Calculate profit margin percentage
 * Pure function - no side effects
 */
export function calculateProfitMargin(profit: number, hpp: number): number {
    if (hpp === 0) return 0;
    return (profit / hpp) * 100;
}

/**
 * Check if price is profitable
 * Pure function - no side effects
 */
export function isProfitable(finalPrice: number, hpp: number): boolean {
    return finalPrice > hpp;
}

/**
 * Get profit status
 * Pure function - no side effects
 */
export function getProfitStatus(finalPrice: number, hpp: number): 'profit' | 'break-even' | 'loss' {
    if (finalPrice > hpp) return 'profit';
    if (finalPrice === hpp) return 'break-even';
    return 'loss';
}
