/**
 * TDD Tests for product-form-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Validation
  validateProductForm,
  isFormValid,
  
  // Generators
  generateSku,
  generateBarcode,
  generateBatchNumber,
  
  // Data transformation
  parseFormToApiData,
  formatDateForApi,
  formatDateForDisplay,
  parseNumericString,
  
  // HPP calculations
  calculateTotalCost,
  calculateSellingPrice,
  calculateProfitMargin,
  
  // Form helpers
  isEditMode,
  hasUnsavedChanges,
  createEmptyFormData,
  resetFormData,
  supplierExistsInList,
  formatCurrency,
  isValidBarcode,
  isValidSku
} from '../product-form-core';
import { ProductFormData } from '../product-form-core';

// Mock form data for tests
const createMockFormData = (overrides: Partial<ProductFormData> = {}): ProductFormData => ({
  name: "Test Product",
  product_code: "",
  description: "Test description",
  barcode: "",
  category: "Test Category",
  price: "10000",
  stock: "50",
  unit: "pcs",
  threshold: "10",
  purchase_price: "8000",
  min_selling_price: "",
  batch_number: "",
  expiry_date: "",
  purchase_date: "",
  supplierId: "",
  conversionTargetId: "",
  conversionRate: "",
  hpp_calculation_details: { costs: [], safetyMargin: 0, retailMargin: 0 },
  ...overrides,
});

describe('validateProductForm', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns error for empty name', () => {
      const result = validateProductForm(createMockFormData({ name: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Nama produk wajib diisi");
    });
    
    it('returns error for name too short', () => {
      const result = validateProductForm(createMockFormData({ name: "A" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Nama produk minimal 2 karakter");
    });
    
    it('returns error for empty price', () => {
      const result = validateProductForm(createMockFormData({ price: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Harga wajib diisi");
    });
    
    it('returns error for negative price', () => {
      const result = validateProductForm(createMockFormData({ price: "-100" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Harga harus berupa angka positif");
    });
    
    it('returns error for empty stock', () => {
      const result = validateProductForm(createMockFormData({ stock: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Stok wajib diisi");
    });
    
    it('returns error for negative stock', () => {
      const result = validateProductForm(createMockFormData({ stock: "-5" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Stok harus berupa angka positif");
    });
    
    it('returns error for empty unit', () => {
      const result = validateProductForm(createMockFormData({ unit: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Satuan wajib diisi");
    });
    
    it('returns error for invalid purchase price', () => {
      const result = validateProductForm(createMockFormData({ purchase_price: "abc" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Harga beli harus berupa angka positif");
    });
    
    it('returns error for invalid min selling price', () => {
      const result = validateProductForm(createMockFormData({ min_selling_price: "invalid" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Harga jual minimum harus berupa angka positif");
    });
    
    it('returns error for invalid expiry date', () => {
      const result = validateProductForm(createMockFormData({ expiry_date: "not-a-date" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Format tanggal kadaluarsa tidak valid");
    });
    
    it('returns error for invalid purchase date', () => {
      const result = validateProductForm(createMockFormData({ purchase_date: "invalid-date" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Format tanggal pembelian tidak valid");
    });
    
    it('returns error for invalid threshold', () => {
      const result = validateProductForm(createMockFormData({ threshold: "-5" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Batas minimum harus berupa angka positif");
    });
    
    it('returns error for invalid conversion rate', () => {
      const result = validateProductForm(createMockFormData({ conversionRate: "0" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Konversi harus lebih dari 0");
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns valid for complete form data', () => {
      const result = validateProductForm(createMockFormData());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('allows optional fields to be empty', () => {
      const result = validateProductForm(createMockFormData({
        min_selling_price: "",
        purchase_price: "",
        threshold: ""
      }));
      expect(result.valid).toBe(true);
    });
    
    it('handles valid numbers in numeric fields', () => {
      const result = validateProductForm(createMockFormData({
        price: "15000.50",
        stock: "100.25",
        purchase_price: "12000"
      }));
      expect(result.valid).toBe(true);
    });
    
    it('handles valid dates', () => {
      const result = validateProductForm(createMockFormData({
        expiry_date: "2025-12-31",
        purchase_date: "2025-01-15"
      }));
      expect(result.valid).toBe(true);
    });
  });
});

describe('isFormValid', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty name', () => {
      expect(isFormValid(createMockFormData({ name: "" }))).toBe(false);
    });
    
    it('returns false for empty price', () => {
      expect(isFormValid(createMockFormData({ price: "" }))).toBe(false);
    });
    
    it('returns false for empty stock', () => {
      expect(isFormValid(createMockFormData({ stock: "" }))).toBe(false);
    });
    
    it('returns false for empty unit', () => {
      expect(isFormValid(createMockFormData({ unit: "" }))).toBe(false);
    });
    
    it('returns false for negative price', () => {
      expect(isFormValid(createMockFormData({ price: "-100" }))).toBe(false);
    });
    
    it('returns false for negative stock', () => {
      expect(isFormValid(createMockFormData({ stock: "-5" }))).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for valid form', () => {
      expect(isFormValid(createMockFormData())).toBe(true);
    });
  });
});

describe('generateSku', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty for empty name and no existing code', () => {
      const result = generateSku({ productName: "" });
      expect(result).toBe("");
    });
    
    it('returns existing code if provided', () => {
      const result = generateSku({ productName: "Test", existingCode: "EXIST-001" });
      expect(result).toBe("EXIST-001");
    });
    
    it('generates new SKU when existing code is whitespace-only', () => {
      const result = generateSku({ productName: "Test", existingCode: "   " });
      // Should generate new SKU since existing code is not meaningful
      expect(result).toMatch(/^TEST-\d{3}$/);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('generates SKU from product name', () => {
      const result = generateSku({ productName: "Mie Goreng" });
      expect(result).toMatch(/^MIEGO-\d{3}$/);
    });
    
    it('uses only first 5 characters of name', () => {
      const result = generateSku({ productName: "Very Long Product Name" });
      expect(result).toMatch(/^VERYL-\d{3}$/);
    });
    
    it('removes special characters', () => {
      const result = generateSku({ productName: "Mie@Goreng#" });
      expect(result).toMatch(/^MIEGO-\d{3}$/);
    });
    
    it('generates different SKUs for same name (random component)', () => {
      const spy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.123) // Wil become 123
        .mockReturnValueOnce(0.456); // Will become 456
        
      const result1 = generateSku({ productName: "Test Product" });
      const result2 = generateSku({ productName: "Test Product" });
      
      // Both should have same format but different random parts
      expect(result1).not.toBe(result2);
      expect(result1).toBe("TESTP-123");
      expect(result2).toBe("TESTP-456");
      
      spy.mockRestore();
    });
  });
});

describe('generateBarcode', () => {
  // Edge cases
  describe('edge cases', () => {
    it('generates 13 digit barcode by default', () => {
      const result = generateBarcode();
      expect(result.length).toBe(13);
      expect(result).toMatch(/^\d{13}$/);
    });
    
    it('uses custom prefix', () => {
      const result = generateBarcode({ prefix: "899" });
      expect(result.startsWith("899")).toBe(true);
      expect(result.length).toBe(13);
    });
    
    it('generates correct length with custom prefix', () => {
      const result = generateBarcode({ prefix: "123", length: 15 });
      expect(result.length).toBe(15);
      expect(result.startsWith("123")).toBe(true);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('generates numeric barcode', () => {
      const result = generateBarcode();
      expect(/^\d+$/.test(result)).toBe(true);
    });
    
    it('generates unique barcodes', () => {
      const barcodes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        barcodes.add(generateBarcode());
      }
      // Most should be unique (allowing for small chance of collision)
      expect(barcodes.size).toBeGreaterThan(90);
    });
  });
});

describe('generateBatchNumber', () => {
  it('generates batch number with correct format', () => {
    const result = generateBatchNumber();
    expect(result).toMatch(/^BATCH-[A-Z0-9]+-[A-Z0-9]+$/);
  });
  
  it('generates unique batch numbers', () => {
    const batchNumbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      batchNumbers.add(generateBatchNumber());
    }
    expect(batchNumbers.size).toBe(100);
  });
});

describe('parseFormToApiData', () => {
  // Edge cases
  describe('edge cases', () => {
    it('handles empty form data', () => {
      const emptyForm = createMockFormData({
        name: "",
        price: "",
        stock: "",
        unit: ""
      });
      const result = parseFormToApiData({ formData: emptyForm });
      expect(result.name).toBe("");
      expect(result.price).toBe(0);
    });
    
    it('converts empty strings to null appropriately', () => {
      const result = parseFormToApiData({ formData: createMockFormData() });
      expect(result.product_code).not.toBeNull();
      expect(result.barcode).toBeNull();
    });
    
    it('handles null threshold', () => {
      const result = parseFormToApiData({ formData: createMockFormData({ threshold: "" }) });
      expect(result.threshold).toBeNull();
    });
    
    it('handles null conversion rate', () => {
      const result = parseFormToApiData({ formData: createMockFormData({ conversionRate: "" }) });
      expect(result.conversionRate).toBeNull();
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('parses form data correctly', () => {
      const result = parseFormToApiData({ formData: createMockFormData() });
      expect(result.name).toBe("Test Product");
      expect(result.price).toBe(10000);
      expect(result.stock).toBe(50);
      expect(result.unit).toBe("pcs");
    });
    
    it('auto-generates SKU when empty', () => {
      const result = parseFormToApiData({ formData: createMockFormData({ product_code: "" }) });
      expect(result.product_code).not.toBeNull();
      expect(result.product_code).not.toBe("");
    });
    
    it('preserves existing SKU', () => {
      const result = parseFormToApiData({ formData: createMockFormData({ product_code: "TEST-001" }) });
      expect(result.product_code).toBe("TEST-001");
    });
  });
});

describe('formatDateForApi', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(formatDateForApi("")).toBeNull();
    });
    
    it('returns null for null input', () => {
      expect(formatDateForApi(null)).toBeNull();
    });
    
    it('returns null for whitespace only', () => {
      expect(formatDateForApi("   ")).toBeNull();
    });
    
    it('returns null for invalid date', () => {
      expect(formatDateForApi("invalid-date")).toBeNull();
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('formats valid date', () => {
      const result = formatDateForApi("2025-12-31");
      expect(result).toContain("2025-12-31");
    });
  });
});

describe('formatDateForDisplay', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns empty for null', () => {
      expect(formatDateForDisplay(null)).toBe("");
    });
    
    it('returns empty for undefined', () => {
      expect(formatDateForDisplay(undefined as any)).toBe("");
    });
    
    it('returns empty for invalid date string', () => {
      expect(formatDateForDisplay("invalid")).toBe("");
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('formats date string correctly', () => {
      expect(formatDateForDisplay("2025-12-31T00:00:00.000Z")).toBe("2025-12-31");
    });
    
    it('formats Date object correctly', () => {
      const date = new Date("2025-12-31");
      expect(formatDateForDisplay(date)).toBe("2025-12-31");
    });
  });
});

describe('parseNumericString', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns default for empty string', () => {
      expect(parseNumericString("")).toBe(0);
    });
    
    it('returns default for whitespace', () => {
      expect(parseNumericString("   ")).toBe(0);
    });
    
    it('returns default for non-numeric', () => {
      expect(parseNumericString("abc")).toBe(0);
    });
    
    it('returns custom default', () => {
      expect(parseNumericString("", 100)).toBe(100);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('parses integer correctly', () => {
      expect(parseNumericString("100")).toBe(100);
    });
    
    it('parses decimal correctly', () => {
      expect(parseNumericString("99.50")).toBe(99.5);
    });
    
    it('parses negative numbers', () => {
      expect(parseNumericString("-50")).toBe(-50);
    });
  });
});

describe('calculateTotalCost', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for empty costs', () => {
      expect(calculateTotalCost({ costs: [], safetyMargin: 0, retailMargin: 0 })).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates total correctly', () => {
      const result = calculateTotalCost({
        costs: [
          { id: "1", name: "Material", amount: 5000 },
          { id: "2", name: "Labor", amount: 3000 }
        ],
        safetyMargin: 0,
        retailMargin: 0
      });
      expect(result).toBe(8000);
    });
  });
});

describe('calculateSellingPrice', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns higher of safety or retail price', () => {
      const result = calculateSellingPrice({
        totalCost: 10000,
        safetyMargin: 10,
        retailMargin: 20
      });
      // Retail: 10000 * 1.20 = 12000
      // Safety: 10000 * 1.10 = 11000
      expect(result).toBe(12000);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates when safety margin is higher', () => {
      const result = calculateSellingPrice({
        totalCost: 10000,
        safetyMargin: 30,
        retailMargin: 10
      });
      expect(result).toBe(13000); // Safety wins
    });
  });
});

describe('calculateProfitMargin', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns 0 for zero cost', () => {
      expect(calculateProfitMargin({ sellingPrice: 10000, costPrice: 0 })).toBe(0);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('calculates profit margin correctly', () => {
      // Cost: 10000, Sell: 15000 = 50% margin
      const result = calculateProfitMargin({ sellingPrice: 15000, costPrice: 10000 });
      expect(result).toBe(50);
    });
  });
});

describe('isEditMode', () => {
  it('returns false for undefined', () => {
    expect(isEditMode(undefined)).toBe(false);
  });
  
  it('returns false for empty string', () => {
    expect(isEditMode("")).toBe(false);
  });
  
  it('returns true for valid productId', () => {
    expect(isEditMode("prod-123")).toBe(true);
  });
});

describe('hasUnsavedChanges', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false when original is null', () => {
      expect(hasUnsavedChanges({
        originalData: null,
        currentData: createMockFormData()
      })).toBe(false);
    });
    
    it('returns false when data is identical', () => {
      const data = createMockFormData();
      expect(hasUnsavedChanges({
        originalData: data,
        currentData: { ...data }
      })).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true when data differs', () => {
      expect(hasUnsavedChanges({
        originalData: createMockFormData(),
        currentData: createMockFormData({ name: "Different Name" })
      })).toBe(true);
    });
  });
});

describe('createEmptyFormData', () => {
  it('creates form with default values', () => {
    const result = createEmptyFormData();
    expect(result.name).toBe("");
    expect(result.price).toBe("");
    expect(result.unit).toBe("pcs");
    expect(result.hpp_calculation_details.costs).toEqual([]);
  });
});

describe('resetFormData', () => {
  it('creates empty form data', () => {
    const result = resetFormData();
    expect(result.name).toBe("");
    expect(result.price).toBe("");
  });
});

describe('supplierExistsInList', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty list', () => {
      const result = supplierExistsInList({
        supplier: { id: "s1", name: "Test", phone: "", address: "" },
        supplierList: []
      });
      expect(result).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true when supplier exists', () => {
      const result = supplierExistsInList({
        supplier: { id: "s1", name: "Test", phone: "", address: "" },
        supplierList: [{ id: "s1", name: "Test", phone: "", address: "" }]
      });
      expect(result).toBe(true);
    });
    
    it('returns false when supplier not in list', () => {
      const result = supplierExistsInList({
        supplier: { id: "s2", name: "Test", phone: "", address: "" },
        supplierList: [{ id: "s1", name: "Test", phone: "", address: "" }]
      });
      expect(result).toBe(false);
    });
  });
});

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toContain("0");
  });
  
  it('formats large number', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("1.000.000");
  });
});

describe('isValidBarcode', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isValidBarcode("")).toBe(false);
    });
    
    it('returns false for too short', () => {
      expect(isValidBarcode("1234567")).toBe(false);
    });
    
    it('returns false for too long', () => {
      expect(isValidBarcode("123456789012345")).toBe(false);
    });
    
    it('returns false for non-numeric', () => {
      expect(isValidBarcode("12345abc6789")).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for valid barcode', () => {
      expect(isValidBarcode("1234567890123")).toBe(true);
    });
  });
});

describe('isValidSku', () => {
  // Edge cases
  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isValidSku("")).toBe(false);
    });
    
    it('returns false for too short', () => {
      expect(isValidSku("AB")).toBe(false);
    });
  });
  
  // Normal cases
  describe('normal cases', () => {
    it('returns true for valid SKU', () => {
      expect(isValidSku("TEST-001")).toBe(true);
    });
    
    it('returns true for alphanumeric SKU', () => {
      expect(isValidSku("ABC123")).toBe(true);
    });
  });
});
