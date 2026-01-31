// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  code?: string;
}

export interface CostItem {
  id: string;
  name: string;
  amount: number;
}

export interface HppData {
  costs: CostItem[];
  safetyMargin: number;
  retailMargin: number;
}

export interface ProductFormData {
  name: string;
  product_code: string;
  description: string;
  barcode: string;
  category: string;
  price: string;
  stock: string;
  unit: string;
  threshold: string;
  purchase_price: string;
  min_selling_price: string;
  batch_number: string;
  expiry_date: string;
  purchase_date: string;
  supplierId: string;
  conversionTargetId: string;
  conversionRate: string;
  hpp_calculation_details: HppData | any;
}

export interface ProductApiData {
  name: string;
  product_code: string | null;
  description: string;
  barcode: string | null;
  category: string | null;
  price: number;
  stock: number;
  unit: string;
  threshold: number | null;
  purchase_price: number | null;
  min_selling_price: number | null;
  batch_number: string | null;
  expiry_date: Date | null;
  purchase_date: Date | null;
  supplierId: string | null;
  conversionTargetId: string | null;
  conversionRate: number | null;
  hpp_calculation_details: HppData | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SkuGeneratorParams {
  productName: string;
  existingCode?: string;
}

export interface BarcodeGeneratorParams {
  prefix?: string;
  length?: number;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate form data - returns validation result with errors
 * Pure function - no side effects
 */
export function validateProductForm(data: ProductFormData): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!data.name.trim()) {
    errors.push("Nama produk wajib diisi");
  } else if (data.name.length < 2) {
    errors.push("Nama produk minimal 2 karakter");
  }

  // Price validation
  if (!data.price.trim()) {
    errors.push("Harga wajib diisi");
  } else {
    const price = parseFloat(data.price);
    if (isNaN(price) || price < 0) {
      errors.push("Harga harus berupa angka positif");
    }
  }

  // Stock validation
  if (!data.stock.trim()) {
    errors.push("Stok wajib diisi");
  } else {
    const stock = parseFloat(data.stock);
    if (isNaN(stock) || stock < 0) {
      errors.push("Stok harus berupa angka positif");
    }
  }

  // Unit validation
  if (!data.unit.trim()) {
    errors.push("Satuan wajib diisi");
  }

  // Purchase price validation
  if (data.purchase_price.trim()) {
    const purchasePrice = parseFloat(data.purchase_price);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push("Harga beli harus berupa angka positif");
    }
  }

  // Min selling price validation
  if (data.min_selling_price.trim()) {
    const minSellingPrice = parseFloat(data.min_selling_price);
    if (isNaN(minSellingPrice) || minSellingPrice < 0) {
      errors.push("Harga jual minimum harus berupa angka positif");
    }
  }

  // Expiry date validation
  if (data.expiry_date.trim()) {
    const expiryDate = new Date(data.expiry_date);
    if (isNaN(expiryDate.getTime())) {
      errors.push("Format tanggal kadaluarsa tidak valid");
    }
  }

  // Purchase date validation
  if (data.purchase_date.trim()) {
    const purchaseDate = new Date(data.purchase_date);
    if (isNaN(purchaseDate.getTime())) {
      errors.push("Format tanggal pembelian tidak valid");
    }
  }

  // Threshold validation
  if (data.threshold.trim()) {
    const threshold = parseFloat(data.threshold);
    if (isNaN(threshold) || threshold < 0) {
      errors.push("Batas minimum harus berupa angka positif");
    }
  }

  // Conversion rate validation
  if (data.conversionRate.trim()) {
    const conversionRate = parseFloat(data.conversionRate);
    if (isNaN(conversionRate) || conversionRate <= 0) {
      errors.push("Konversi harus lebih dari 0");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Quick check if form is valid (without getting all errors)
 * Pure function - no side effects
 */
export function isFormValid(data: ProductFormData): boolean {
  if (!data.name.trim()) return false;
  if (!data.price.trim()) return false;
  if (!data.stock.trim()) return false;
  if (!data.unit.trim()) return false;
  
  const price = parseFloat(data.price);
  const stock = parseFloat(data.stock);
  if (isNaN(price) || price < 0) return false;
  if (isNaN(stock) || stock < 0) return false;
  
  return true;
}

// ============================================================================
// GENERATOR FUNCTIONS
// ============================================================================

/**
 * Generate SKU from product name
 * Pure function - no side effects
 */
export function generateSku(params: SkuGeneratorParams): string {
  const { productName, existingCode } = params;
  
  // Return existing code if provided and not empty/whitespace
  // Note: whitespace-only is treated as empty
  const trimmedCode = existingCode ? existingCode.trim() : "";
  if (trimmedCode.length > 0) {
    return trimmedCode;
  }
  
  // Return empty if no name to generate from
  if (!productName.trim()) {
    return "";
  }
  
  const cleanName = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 5);
  
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  
  return `${cleanName}-${random}`;
}

/**
 * Generate barcode (EAN-13 format compatible)
 * Pure function - no side effects
 */
export function generateBarcode(params: BarcodeGeneratorParams = {}): string {
  const { prefix = "200", length = 13 } = params;
  
  // Calculate how many random digits we need
  // Prefix (3) + random digits = total length
  const randomDigitsNeeded = length - prefix.length;
  const randomDigits = Math.floor(Math.random() * Math.pow(10, randomDigitsNeeded))
    .toString()
    .padStart(randomDigitsNeeded, "0");
  
  return prefix + randomDigits;
}

/**
 * Generate batch number
 * Pure function - no side effects
 */
export function generateBatchNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${timestamp}-${random}`;
}

// ============================================================================
// DATA TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Parse form data to API format
 * Pure function - no side effects
 */
export function parseFormToApiData(params: {
  formData: ProductFormData;
  productId?: string;
}): ProductApiData {
  const { formData } = params;
  
  // Parse numbers
  const price = parseFloat(formData.price) || 0;
  const stock = parseFloat(formData.stock) || 0;
  const threshold = formData.threshold ? parseFloat(formData.threshold) : null;
  const purchasePrice = formData.purchase_price ? parseFloat(formData.purchase_price) : null;
  const minSellingPrice = formData.min_selling_price ? parseFloat(formData.min_selling_price) : null;
  const conversionRate = formData.conversionRate ? parseFloat(formData.conversionRate) : null;
  
  // Parse dates
  let expiryDate: Date | null = null;
  if (formData.expiry_date.trim()) {
    const parsed = new Date(formData.expiry_date);
    if (!isNaN(parsed.getTime())) {
      expiryDate = parsed;
    }
  }
  
  let purchaseDate: Date | null = null;
  if (formData.purchase_date.trim()) {
    const parsed = new Date(formData.purchase_date);
    if (!isNaN(parsed.getTime())) {
      purchaseDate = parsed;
    }
  }
  
  // Auto-generate product code if empty
  let productCode = formData.product_code.trim();
  if (!productCode && formData.name.trim()) {
    productCode = generateSku({ productName: formData.name });
  }
  
  return {
    name: formData.name.trim(),
    product_code: productCode || null,
    description: formData.description.trim(),
    barcode: formData.barcode.trim() || null,
    category: formData.category.trim() || null,
    price,
    stock,
    unit: formData.unit,
    threshold,
    purchase_price: purchasePrice,
    min_selling_price: minSellingPrice,
    batch_number: formData.batch_number.trim() || null,
    expiry_date: expiryDate,
    purchase_date: purchaseDate,
    supplierId: formData.supplierId || null,
    conversionTargetId: formData.conversionTargetId || null,
    conversionRate,
    hpp_calculation_details: formData.hpp_calculation_details || null,
  };
}

/**
 * Format date string for API
 * Pure function - no side effects
 */
export function formatDateForApi(dateString: string | null): string | null {
  if (!dateString || !dateString.trim()) {
    return null;
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date.toISOString();
}

/**
 * Format date for display (YYYY-MM-DD)
 * Pure function - no side effects
 */
export function formatDateForDisplay(dateValue: string | Date | null): string {
  if (!dateValue) return "";
  
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  if (isNaN(date.getTime())) return "";
  
  return date.toISOString().split("T")[0];
}

/**
 * Parse numeric string safely
 * Pure function - no side effects
 */
export function parseNumericString(value: string, defaultValue: number = 0): number {
  if (!value || !value.trim()) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// HPP CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate total cost from HPP data
 * Pure function - no side effects
 */
export function calculateTotalCost(hppData: HppData): number {
  return hppData.costs.reduce((total, item) => total + item.amount, 0);
}

/**
 * Calculate selling price from HPP
 * Pure function - no side effects
 */
export function calculateSellingPrice(params: {
  totalCost: number;
  safetyMargin: number;
  retailMargin: number;
}): number {
  const { totalCost, safetyMargin, retailMargin } = params;
  
  // Price with safety margin (minimum profit)
  const safetyPrice = totalCost * (1 + safetyMargin / 100);
  
  // Price with retail margin (markup)
  const retailPrice = totalCost * (1 + retailMargin / 100);
  
  // Return the higher of the two
  return Math.max(safetyPrice, retailPrice);
}

/**
 * Calculate profit margin percentage
 * Pure function - no side effects
 */
export function calculateProfitMargin(params: {
  sellingPrice: number;
  costPrice: number;
}): number {
  const { sellingPrice, costPrice } = params;
  
  if (costPrice <= 0) return 0;
  
  return ((sellingPrice - costPrice) / costPrice) * 100;
}

// ============================================================================
// FORM HELPERS
// ============================================================================

/**
 * Check if product is being edited (has productId)
 * Pure function - no side effects
 */
export function isEditMode(productId?: string): boolean {
  return !!productId;
}

/**
 * Check if form has unsaved changes
 * Pure function - no side effects
 */
export function hasUnsavedChanges(params: {
  originalData: ProductFormData | null;
  currentData: ProductFormData;
}): boolean {
  const { originalData, currentData } = params;
  
  if (!originalData) return false;
  
  return JSON.stringify(originalData) !== JSON.stringify(currentData);
}

/**
 * Create empty form data
 * Pure function - no side effects
 */
export function createEmptyFormData(): ProductFormData {
  return {
    name: "",
    product_code: "",
    description: "",
    barcode: "",
    category: "",
    price: "",
    stock: "",
    unit: "pcs",
    threshold: "",
    purchase_price: "",
    min_selling_price: "",
    batch_number: "",
    expiry_date: "",
    purchase_date: "",
    supplierId: "",
    conversionTargetId: "",
    conversionRate: "",
    hpp_calculation_details: { costs: [], safetyMargin: 0, retailMargin: 0 },
  };
}

/**
 * Reset form to empty state
 * Pure function - no side effects
 */
export function resetFormData(): ProductFormData {
  return createEmptyFormData();
}

/**
 * Check if supplier already exists in list
 * Pure function - no side effects
 */
export function supplierExistsInList(params: {
  supplier: Supplier;
  supplierList: Supplier[];
}): boolean {
  const { supplier, supplierList } = params;
  return supplierList.some(s => s.id === supplier.id);
}

/**
 * Format currency for display
 * Pure function - no side effects
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validate barcode format
 * Pure function - no side effects
 */
export function isValidBarcode(barcode: string): boolean {
  // Basic validation - should be numeric and reasonable length
  if (!barcode || barcode.length < 8 || barcode.length > 14) {
    return false;
  }
  return /^\d+$/.test(barcode);
}

/**
 * Validate SKU format
 * Pure function - no side effects
 */
export function isValidSku(sku: string): boolean {
  if (!sku || sku.length < 3) return false;
  // SKU should be alphanumeric with optional hyphen
  return /^[A-Z0-9-]+$/i.test(sku);
}
