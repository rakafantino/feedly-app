/**
 * TDD Tests for csv-core.ts
 * Edge cases first, then normal cases
 */

import {
  // Constants
  getExportHeaders,
  getRequiredHeaders,
  getOptionalHeaders,
  getDefaultCsvConfig,
  
  // Initialization
  createEmptyImportResult,
  createDefaultExportOptions,
  
  // Parsing
  parseCSVLine,
  parseCSVContent,
  parseProductRow,
  parseDateString,
  
  // Validation
  validateHeaders,
  validateProductRow,
  validateCSVContent,
  
  // Formatting
  formatCSVValue,
  formatProductForExport,
  generateCSVContent,
  formatFileSize,
  formatValidationSummary,
  
  // Export Helpers
  generateExportFilename,
  isValidCSVFile,
  getImportTemplate,
  createTemplateBlob,
  
  // Import Helpers
  transformToApiPayload,
  calculateImportStats,
  getColumnMapping,
  matchHeader,
  normalizeHeaders,
  
  // Error Handling
  categorizeErrors,
  getUserFriendlyError,
  sanitizeError,
  
  // Types
  ProductCsvRow,
  ProductImportResult
} from '../csv-core';

describe('getExportHeaders', () => {
  it('returns all headers by default', () => {
    const result = getExportHeaders();
    expect(result).toContain('name');
    expect(result).toContain('price');
    expect(result).toContain('stock');
    expect(result).toContain('unit');
    expect(result).toContain('purchase_price');
    expect(result).toContain('min_selling_price');
    expect(result).toContain('supplier_name');
    expect(result).toContain('expiry_date');
    expect(result).toContain('batch_number');
  });
});

describe('getRequiredHeaders', () => {
  it('returns essential headers', () => {
    const result = getRequiredHeaders();
    expect(result).toEqual(['name', 'price', 'stock', 'unit']);
  });
});

describe('getOptionalHeaders', () => {
  it('returns optional headers', () => {
    const result = getOptionalHeaders();
    expect(result).toContain('product_code');
    expect(result).toContain('description');
    expect(result).toContain('category');
    expect(result).toContain('barcode');
    expect(result).toContain('purchase_price');
  });
});

describe('getDefaultCsvConfig', () => {
  it('returns default configuration', () => {
    const result = getDefaultCsvConfig();
    expect(result.delimiter).toBe(',');
    expect(result.hasHeader).toBe(true);
    expect(result.encoding).toBe('utf-8');
    expect(result.maxFileSizeMb).toBe(5);
  });
});

describe('createEmptyImportResult', () => {
  it('creates empty result', () => {
    const result = createEmptyImportResult();
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('createDefaultExportOptions', () => {
  it('creates default options', () => {
    const result = createDefaultExportOptions();
    expect(result.includeBatches).toBe(false);
    expect(result.includeSupplier).toBe(true);
    expect(result.includeConversion).toBe(false);
  });
});

describe('parseCSVLine', () => {
  describe('edge cases', () => {
    it('handles empty line', () => {
      expect(parseCSVLine('')).toEqual(['']);
    });
    
    it('handles single value', () => {
      expect(parseCSVLine('hello')).toEqual(['hello']);
    });
    
    it('handles quotes with commas', () => {
      const result = parseCSVLine('"hello, world",test');
      expect(result).toEqual(['hello, world', 'test']);
    });
    
    it('handles escaped quotes', () => {
      const result = parseCSVLine('"He said ""Hello"""');
      expect(result).toEqual(['He said "Hello"']);
    });
  });
  
  describe('normal cases', () => {
    it('parses simple CSV', () => {
      const result = parseCSVLine('a,b,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });
    
    it('parses with spaces', () => {
      const result = parseCSVLine('a, b, c');
      expect(result).toEqual(['a', ' b', ' c']);
    });
  });
});

describe('parseCSVContent', () => {
  it('parses content correctly', () => {
    const content = `name,price,stock
Product A,100,50
Product B,200,75`;
    const result = parseCSVContent(content);
    expect(result.length).toBe(3); // 2 data rows + 1 header
  });
  
  it('filters empty lines', () => {
    const content = `name,price

Product A,100

Product B,200

`;
    const result = parseCSVContent(content);
    expect(result.length).toBe(3);
  });
});

describe('parseProductRow', () => {
  it('parses values correctly', () => {
    const headers = ['name', 'price', 'stock', 'unit'];
    const values = ['Product A', '150000', '100', 'pcs'];
    const result = parseProductRow(values, headers);
    
    expect(result.name).toBe('Product A');
    expect(result.price).toBe(150000);
    expect(result.stock).toBe(100);
    expect(result.unit).toBe('pcs');
  });
  
  it('handles null values', () => {
    const headers = ['name', 'description'];
    const values = ['Product A', ''];
    const result = parseProductRow(values, headers);
    expect(result.description).toBeNull();
  });
  
  it('parses numeric fields correctly', () => {
    const headers = ['price', 'stock', 'threshold'];
    const values = ['100', '50', '10'];
    const result = parseProductRow(values, headers);
    
    expect(result.price).toBe(100);
    expect(result.stock).toBe(50);
    expect(result.threshold).toBe(10);
  });
});

describe('parseDateString', () => {
  it('parses YYYY-MM-DD', () => {
    expect(parseDateString('2025-12-31')).toBe('2025-12-31');
  });
  
  it('parses DD/MM/YYYY', () => {
    expect(parseDateString('31/12/2025')).toBe('2025-12-31');
  });
  
  it('parses DD-MM-YYYY', () => {
    expect(parseDateString('31-12-2025')).toBe('2025-12-31');
  });
  
  it('returns null for invalid', () => {
    expect(parseDateString('invalid')).toBeNull();
    expect(parseDateString('')).toBeNull();
  });
});

describe('validateHeaders', () => {
  it('returns valid for correct headers', () => {
    const headers = ['name', 'price', 'stock', 'unit'];
    const result = validateHeaders(headers, ['name', 'price', 'stock', 'unit']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('returns error for missing required', () => {
    const headers = ['name', 'price'];
    const result = validateHeaders(headers, ['name', 'price', 'stock', 'unit']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required header: stock');
    expect(result.errors).toContain('Missing required header: unit');
  });
});

describe('validateProductRow', () => {
  it('validates required fields', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Test Product',
      price: 100000,
      stock: 50,
      unit: 'pcs'
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('returns error for missing name', () => {
    const product: Partial<ProductCsvRow> = {
      price: 100000,
      stock: 50,
      unit: 'pcs'
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name is required'))).toBe(true);
  });
  
  it('returns error for invalid price', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Test',
      price: -100,
      stock: 50,
      unit: 'pcs'
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid price'))).toBe(true);
  });
  
  it('returns error for negative stock', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Test',
      price: 100,
      stock: -10,
      unit: 'pcs'
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(false);
  });
  
  it('warns when purchase price > selling price', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Test',
      price: 100,
      stock: 50,
      unit: 'pcs',
      purchase_price: 150
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  
  it('validates expiry date format', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Test',
      price: 100,
      stock: 50,
      unit: 'pcs',
      expiry_date: 'invalid-date'
    };
    const result = validateProductRow(product, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid expiry date'))).toBe(true);
  });
});

describe('validateCSVContent', () => {
  it('returns valid for correct CSV', () => {
    const content = `name,price,stock,unit
Product A,100,50,pcs
Product B,200,75,pcs`;
    const result = validateCSVContent(content);
    expect(result.valid).toBe(true);
  });
  
  it('detects column mismatch', () => {
    const content = `name,price,stock,unit
Product A,100,50,pcs,extra`;
    const result = validateCSVContent(content);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.rowErrors).length).toBeGreaterThan(0);
  });
  
  it('returns error for empty file', () => {
    const result = validateCSVContent('');
    expect(result.valid).toBe(false);
    expect(result.headerErrors.length).toBeGreaterThan(0);
  });
});

describe('formatCSVValue', () => {
  it('handles null/undefined', () => {
    expect(formatCSVValue(null)).toBe('');
    expect(formatCSVValue(undefined)).toBe('');
  });
  
  it('escapes commas', () => {
    expect(formatCSVValue('hello, world')).toBe('"hello, world"');
  });
  
  it('escapes quotes', () => {
    expect(formatCSVValue('he said "hi"')).toBe('"he said ""hi"""');
  });
});

describe('formatProductForExport', () => {
  it('formats product correctly', () => {
    const product = {
      name: 'Product A',
      product_code: 'SKU-001',
      price: 100000,
      stock: 50
    };
    const result = formatProductForExport(product);
    expect(result[0]).toBe('Product A');
    expect(result[1]).toBe('SKU-001');
    expect(result[5]).toBe('100000');
  });
});

describe('generateCSVContent', () => {
  it('generates CSV with header', () => {
    const products = [
      { name: 'Product A', price: 100 },
      { name: 'Product B', price: 200 }
    ];
    const result = generateCSVContent(products);
    expect(result).toContain('name');
    expect(result).toContain('Product A');
    expect(result).toContain('Product B');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });
  
  it('formats KB', () => {
    expect(formatFileSize(2048)).toBe('2.00 KB');
  });
  
  it('formats MB', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('formatValidationSummary', () => {
  it('formats summary correctly', () => {
    const validation = {
      valid: true,
      rowCount: 10,
      headerErrors: [],
      rowErrors: {},
      allWarnings: ['Warning 1']
    };
    const result = formatValidationSummary(validation as any);
    expect(result).toContain('10');
    expect(result).toContain('Warning');
  });
});

describe('generateExportFilename', () => {
  it('generates filename with date', () => {
    const result = generateExportFilename();
    expect(result).toMatch(/products-export-\d{4}-\d{2}-\d{2}\.csv/);
  });
  
  it('uses custom prefix', () => {
    const result = generateExportFilename('inventory');
    expect(result).toMatch(/inventory-export-\d{4}-\d{2}-\d{2}\.csv/);
  });
});

describe('isValidCSVFile', () => {
  it('accepts CSV file', () => {
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    const result = isValidCSVFile(file);
    expect(result.valid).toBe(true);
  });
  
  it('rejects non-CSV file', () => {
    const file = new File([''], 'test.txt', { type: 'text/plain' });
    const result = isValidCSVFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('CSV');
  });
  
  it('rejects large file', () => {
    // Mock file size > 5MB
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });
    const result = isValidCSVFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('terlalu besar');
  });
});

describe('getImportTemplate', () => {
  it('returns CSV content', () => {
    const result = getImportTemplate();
    expect(result).toContain('name');
    expect(result).toContain('product_code');
    expect(result).toContain('purchase_price');
    expect(result).toContain('min_selling_price');
    expect(result).toContain('expiry_date');
    expect(result).toContain('batch_number');
  });
});

describe('createTemplateBlob', () => {
  it('creates blob with CSV content', () => {
    const blob = createTemplateBlob();
    expect(blob.type).toBe('text/csv');
  });
});

describe('transformToApiPayload', () => {
  it('transforms row to payload', () => {
    const product: Partial<ProductCsvRow> = {
      name: 'Product A',
      price: 100000,
      stock: 50,
      unit: 'pcs',
      purchase_price: 80000,
      expiry_date: '2025-12-31'
    };
    const result = transformToApiPayload(product);
    expect(result.name).toBe('Product A');
    expect(result.price).toBe(100000);
    expect(result.expiry_date).toBe('2025-12-31');
  });
});

describe('calculateImportStats', () => {
  it('calculates totals', () => {
    const results: ProductImportResult[] = [
      { imported: 5, skipped: 1, errors: ['Error 1', 'Error 2'], warnings: [] },
      { imported: 3, skipped: 0, errors: ['Error 3'], warnings: [] }
    ];
    const result = calculateImportStats(results);
    expect(result.totalImported).toBe(8);
    expect(result.totalSkipped).toBe(1);
    expect(result.totalErrors).toBe(3);
  });
});

describe('getColumnMapping', () => {
  it('returns mapping object', () => {
    const result = getColumnMapping();
    expect(result.name).toContain('name');
    expect(result.name).toContain('nama');
    expect(result.product_code).toContain('sku');
    expect(result.price).toContain('harga');
  });
});

describe('matchHeader', () => {
  it('matches exact header', () => {
    expect(matchHeader('name')).toBe('name');
    expect(matchHeader('price')).toBe('price');
  });
  
  it('matches aliases', () => {
    expect(matchHeader('product_name')).toBe('name');
    expect(matchHeader('nama_produk')).toBe('name');
    expect(matchHeader('harga')).toBe('price');
    expect(matchHeader('stok')).toBe('stock');
    expect(matchHeader('satuan')).toBe('unit');
  });
  
  it('returns header if no match', () => {
    expect(matchHeader('unknown_field')).toBe('unknown_field');
  });
});

describe('normalizeHeaders', () => {
  it('normalizes headers to standard names', () => {
    const headers = ['Product Name', 'Harga', 'Stok', 'Satuan'];
    const result = normalizeHeaders(headers);
    expect(result).toEqual(['name', 'price', 'stock', 'unit']);
  });
});

describe('normalizeHeaders', () => {
  it('normalizes headers to standard names', () => {
    const headers = ['Product Name', 'Harga', 'Stok', 'Satuan'];
    const result = normalizeHeaders(headers);
    expect(result).toEqual(['name', 'price', 'stock', 'unit']);
  });
});

describe('categorizeErrors', () => {
  it('categorizes validation errors', () => {
    const errors = [
      'Row 2: name is required',
      'Row 3: Invalid price value',
      'Row 4: barcode already exists',
      'Database error'
    ];
    const result = categorizeErrors(errors);
    expect(result.validation.length).toBe(2);
    expect(result.duplicate.length).toBe(1);
    expect(result.database.length).toBe(1);
  });
});

describe('getUserFriendlyError', () => {
  it('converts barcode duplicate to user-friendly message', () => {
    expect(getUserFriendlyError('barcode duplicate')).toContain('Barcode sudah digunakan');
  });
  
  it('converts name required to user-friendly message', () => {
    expect(getUserFriendlyError('name is required')).toContain('Nama produk wajib diisi');
  });
  
  it('converts price error to user-friendly message', () => {
    expect(getUserFriendlyError('price is invalid value')).toContain('Harga produk tidak valid');
  });
});

describe('sanitizeError', () => {
  it('masks sensitive data', () => {
    const result = sanitizeError('Error: password123');
    expect(result).not.toContain('password123');
  });
  
  it('masks long random strings', () => {
    const longString = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4';
    const result = sanitizeError(`Error: ${longString}`);
    expect(result).toContain('***');
  });
});
