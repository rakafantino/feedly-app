// ============================================================================
// TYPES
// ============================================================================

export interface ProductCsvRow {
  name: string;
  product_code?: string | null;
  description?: string | null;
  category?: string | null;
  barcode?: string | null;
  price: number;
  stock: number;
  unit?: string | null;
  threshold?: number | null;
  purchase_price?: number | null;
  min_selling_price?: number | null;
  supplier_name?: string | null;
  supplier_code?: string | null;
  expiry_date?: string | null;
  batch_number?: string | null;
  purchase_date?: string | null;
  conversion_target_id?: string | null;
  conversion_rate?: number | null;
}

export interface ProductImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  includeBatches?: boolean;
  includeSupplier?: boolean;
  includeConversion?: boolean;
  dateFormat?: string;
}

export interface CsvConfig {
  delimiter: string;
  hasHeader: boolean;
  encoding: string;
  maxFileSizeMb: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowNumber: number;
}

export interface CsvValidationResult {
  valid: boolean;
  rowCount: number;
  headerErrors: string[];
  rowErrors: Record<number, string[]>;
  allWarnings: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

export function getExportHeaders(): string[] {
  return [
    'name',
    'product_code',
    'description',
    'category',
    'barcode',
    'price',
    'stock',
    'unit',
    'threshold',
    'purchase_price',
    'min_selling_price',
    'supplier_name',
    'supplier_code',
    'expiry_date',
    'batch_number',
    'purchase_date',
    'conversion_target_id',
    'conversion_rate'
  ];
}

export function getRequiredHeaders(): string[] {
  return ['name', 'price', 'stock', 'unit'];
}

export function getOptionalHeaders(): string[] {
  return [
    'product_code',
    'description',
    'category',
    'barcode',
    'threshold',
    'purchase_price',
    'min_selling_price',
    'supplier_name',
    'supplier_code',
    'expiry_date',
    'batch_number',
    'purchase_date',
    'conversion_target_id',
    'conversion_rate'
  ];
}

export function getDefaultCsvConfig(): CsvConfig {
  return {
    delimiter: ',',
    hasHeader: true,
    encoding: 'utf-8',
    maxFileSizeMb: 5
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function createEmptyImportResult(): ProductImportResult {
  return {
    imported: 0,
    skipped: 0,
    errors: [],
    warnings: []
  };
}

export function createDefaultExportOptions(): ExportOptions {
  return {
    includeBatches: false,
    includeSupplier: true,
    includeConversion: false,
    dateFormat: 'YYYY-MM-DD'
  };
}

// ============================================================================
// PARSING
// ============================================================================

export function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

export function parseCSVContent(content: string, config: CsvConfig = getDefaultCsvConfig()): string[][] {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => parseCSVLine(line, config.delimiter));
}

export function parseProductRow(values: string[], headers: string[]): Partial<ProductCsvRow> {
  const product: Partial<ProductCsvRow> = {};
  
  const numericFields = ['price', 'stock', 'threshold', 'purchase_price', 'min_selling_price', 'conversion_rate'];
  
  headers.forEach((header, index) => {
    let value = values[index]?.trim() || '';
    
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/""/g, '"');
    }
    
    const key = header.toLowerCase().replace(/\s+/g, '_') as keyof ProductCsvRow;
    
    if (numericFields.includes(key)) {
      const numValue = parseFloat(value);
      (product as any)[key] = isNaN(numValue) ? null : numValue;
    } else if (['expiry_date', 'purchase_date'].includes(key)) {
      (product as any)[key] = parseDateString(value) || null;
    } else {
      (product as any)[key] = value || null;
    }
  });
  
  return product;
}

export function parseDateString(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];
  
  for (let i = 0; i < formats.length; i++) {
    const match = dateStr.match(formats[i]);
    if (match) {
      if (i === 0) return dateStr;
      // DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
      if (i === 1 || i === 2) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }
  
  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateHeaders(headers: string[], required: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, '_'));
  
  required.forEach(req => {
    if (!normalizedHeaders.includes(req)) {
      errors.push(`Missing required header: ${req}`);
    }
  });
  
  // Check for common typos
  const typoMap: Record<string, string[]> = {
    'product_cod': ['product_code', 'productcode'],
    'prod_name': ['name', 'product_name'],
    'pricee': ['price'],
    'stok': ['stock']
  };
  
  normalizedHeaders.forEach(h => {
    Object.entries(typoMap).forEach(([typo, corrections]) => {
      if (h.includes(typo) && !corrections.some(c => h === c)) {
        warnings.push(`Possible typo in header: "${h}". Did you mean: ${corrections.join(' or ')}?`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowNumber: 0
  };
}

export function validateProductRow(product: Partial<ProductCsvRow>, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!product.name?.trim()) {
    errors.push(`Row ${rowNumber}: Product name is required`);
  }
  
  if (product.price === null || product.price === undefined) {
    errors.push(`Row ${rowNumber}: Price is required`);
  } else if (isNaN(product.price) || product.price <= 0) {
    errors.push(`Row ${rowNumber}: Invalid price value (must be positive number)`);
  }
  
  if (product.stock === null || product.stock === undefined) {
    errors.push(`Row ${rowNumber}: Stock is required`);
  } else if (isNaN(product.stock) || product.stock < 0) {
    errors.push(`Row ${rowNumber}: Invalid stock value (must be non-negative number)`);
  }
  
  if (!product.unit?.trim()) {
    errors.push(`Row ${rowNumber}: Unit is required`);
  }
  
  if (product.threshold !== null && product.threshold !== undefined && product.threshold < 0) {
    errors.push(`Row ${rowNumber}: Threshold cannot be negative`);
  }
  
  if (product.purchase_price !== null && product.purchase_price !== undefined) {
    if (product.purchase_price < 0) {
      errors.push(`Row ${rowNumber}: Purchase price cannot be negative`);
    }
    if (product.price && product.purchase_price > product.price) {
      warnings.push(`Row ${rowNumber}: Purchase price (${product.purchase_price}) is higher than selling price (${product.price})`);
    }
  }
  
  if (product.min_selling_price !== null && product.min_selling_price !== undefined) {
    if (product.min_selling_price < 0) {
      errors.push(`Row ${rowNumber}: Minimum selling price cannot be negative`);
    }
    if (product.price && product.min_selling_price > product.price) {
      warnings.push(`Row ${rowNumber}: Min selling price (${product.min_selling_price}) is higher than selling price (${product.price})`);
    }
  }
  
  if (product.expiry_date && !parseDateString(product.expiry_date)) {
    errors.push(`Row ${rowNumber}: Invalid expiry date format. Use YYYY-MM-DD or DD/MM/YYYY`);
  }
  
  if (product.purchase_date && !parseDateString(product.purchase_date)) {
    errors.push(`Row ${rowNumber}: Invalid purchase date format. Use YYYY-MM-DD or DD/MM/YYYY`);
  }
  
  if (product.conversion_rate !== null && product.conversion_rate !== undefined) {
    if (product.conversion_rate < 0) {
      errors.push(`Row ${rowNumber}: Conversion rate cannot be negative`);
    }
    if (product.conversion_rate > 0 && product.conversion_rate < 1) {
      warnings.push(`Row ${rowNumber}: Conversion rate ${product.conversion_rate} is less than 1 (product will be divided)`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowNumber
  };
}

export function validateCSVContent(content: string, config: CsvConfig = getDefaultCsvConfig()): CsvValidationResult {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < (config.hasHeader ? 2 : 1)) {
    return {
      valid: false,
      rowCount: 0,
      headerErrors: ['CSV file is empty or has only header'],
      rowErrors: {},
      allWarnings: []
    };
  }
  
  const headers = parseCSVLine(lines[0], config.delimiter);
  const headerValidation = validateHeaders(headers, getRequiredHeaders());
  
  if (!headerValidation.valid) {
    return {
      valid: false,
      rowCount: lines.length - 1,
      headerErrors: headerValidation.errors,
      rowErrors: {},
      allWarnings: headerValidation.warnings
    };
  }
  
  const rowErrors: Record<number, string[]> = {};
  const allWarnings: string[] = [...headerValidation.warnings];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], config.delimiter);
    
    if (lines[i].trim().startsWith('#') || values.every(v => !v.trim())) {
      continue;
    }
    
    if (values.length !== headers.length) {
      rowErrors[i + 1] = [`Column count mismatch. Expected ${headers.length}, got ${values.length}`];
      continue;
    }
    
    const product = parseProductRow(values, headers);
    const rowValidation = validateProductRow(product, i + 1);
    
    if (!rowValidation.valid) {
      rowErrors[i + 1] = rowValidation.errors;
    }
    allWarnings.push(...rowValidation.warnings);
  }
  
  return {
    valid: Object.keys(rowErrors).length === 0,
    rowCount: lines.length - 1,
    headerErrors: [],
    rowErrors,
    allWarnings
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

export function formatProductForExport(product: Record<string, unknown>): string[] {
  const headers = getExportHeaders();
  
  return headers.map(header => {
    const key = header as keyof typeof product;
    const value = product[key];
    
    if (header === 'expiry_date' && value) {
      return formatCSVValue(value);
    }
    
    return formatCSVValue(value);
  });
}

export function generateCSVContent(products: Record<string, unknown>[]): string {
  const headers = getExportHeaders();
  const lines: string[] = [headers.join(',')];
  
  products.forEach(product => {
    const row = formatProductForExport(product);
    lines.push(row.join(','));
  });
  
  return lines.join('\n');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatValidationSummary(validation: CsvValidationResult): string {
  const parts: string[] = [];
  
  if (validation.headerErrors.length > 0) {
    parts.push(`Header errors: ${validation.headerErrors.length}`);
  }
  
  const totalRowErrors = Object.values(validation.rowErrors).flat().length;
  if (totalRowErrors > 0) {
    parts.push(`Row errors: ${totalRowErrors}`);
  }
  
  if (validation.allWarnings.length > 0) {
    parts.push(`Warnings: ${validation.allWarnings.length}`);
  }
  
  parts.push(`Total rows: ${validation.rowCount}`);
  
  return parts.join(' | ');
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function generateExportFilename(prefix: string = 'products'): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-export-${date}.csv`;
}

export function isValidCSVFile(file: File, config: CsvConfig = getDefaultCsvConfig()): { valid: boolean; error?: string } {
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    return { valid: false, error: 'Hanya file CSV yang diperbolehkan' };
  }
  
  const maxSize = config.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: `Ukuran file terlalu besar (maks. ${config.maxFileSizeMb}MB)` };
  }
  
  return { valid: true };
}

export function getImportTemplate(): string {
  const headers = getExportHeaders();
  const sampleData = [
    'Sample Product 1',      // name
    'SKU-001',               // product_code
    'Description here',      // description
    'Electronics',           // category
    '1234567890123',         // barcode
    '150000',                // price
    '100',                   // stock
    'pcs',                   // unit
    '10',                    // threshold
    '120000',                // purchase_price
    '140000',                // min_selling_price
    'Supplier Name',         // supplier_name
    'SUP-001',               // supplier_code
    '2025-12-31',            // expiry_date
    'BATCH-001',             // batch_number
    '2025-01-15',            // purchase_date
    'PROD-CONVERT',          // conversion_target_id
    '2'                      // conversion_rate
  ];
  
  return [headers.join(','), sampleData.join(',')].join('\n');
}

export function createTemplateBlob(): Blob {
  const content = getImportTemplate();
  return new Blob([content], { type: 'text/csv' });
}

// ============================================================================
// IMPORT HELPERS
// ============================================================================

export function transformToApiPayload(product: Partial<ProductCsvRow>): Record<string, unknown> {
  return {
    name: product.name,
    product_code: product.product_code || null,
    description: product.description || null,
    category: product.category || null,
    barcode: product.barcode || null,
    price: product.price,
    stock: product.stock,
    unit: product.unit || null,
    threshold: product.threshold || null,
    purchase_price: product.purchase_price || null,
    min_selling_price: product.min_selling_price || null,
    expiry_date: product.expiry_date ? parseDateString(product.expiry_date) : null,
    batch_number: product.batch_number || null,
    purchase_date: product.purchase_date ? parseDateString(product.purchase_date) : null,
    conversionTargetId: product.conversion_target_id || null,
    conversionRate: product.conversion_rate || null
  };
}

export function calculateImportStats(results: ProductImportResult[]): {
  totalImported: number;
  totalSkipped: number;
  totalErrors: number;
  errorSummary: Record<string, number>;
} {
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const errorSummary: Record<string, number> = {};
  
  results.forEach(result => {
    totalImported += result.imported;
    totalSkipped += result.skipped;
    result.errors.forEach(error => {
      totalErrors++;
      const category = error.split(':')[0] || 'Unknown';
      errorSummary[category] = (errorSummary[category] || 0) + 1;
    });
  });
  
  return {
    totalImported,
    totalSkipped,
    totalErrors,
    errorSummary
  };
}

export function getColumnMapping(): Record<string, string[]> {
  return {
    name: ['name', 'product_name', 'nama', 'nama_produk'],
    product_code: ['product_code', 'sku', 'kode', 'kode_produk', 'productcode'],
    description: ['description', 'desc', 'deskripsi'],
    category: ['category', 'kat', 'kategori'],
    barcode: ['barcode', 'bar_code', 'kode_barcode'],
    price: ['price', 'harga', 'sell_price'],
    stock: ['stock', 'stok', 'quantity', 'qty'],
    unit: ['unit', 'satuan', 'unit_type'],
    threshold: ['threshold', 'minimum_stok', 'batas'],
    purchase_price: ['purchase_price', 'cost', 'harga_beli', 'harga_modal'],
    min_selling_price: ['min_selling_price', 'min_price', 'harga_minimal'],
    supplier_name: ['supplier_name', 'supplier', 'nama_supplier', 'pemasok'],
    supplier_code: ['supplier_code', 'supplier_code', 'kode_supplier', 'kode_pemasok'],
    expiry_date: ['expiry_date', 'expired', 'expired_date', 'tanggal_kadaluarsa'],
    batch_number: ['batch_number', 'batch', 'no_batch', 'nomor_batch']
  };
}

export function matchHeader(header: string): string {
  const normalizedHeader = header.toLowerCase().replace(/[\s-]/g, '_');
  const mapping = getColumnMapping();
  
  for (const [field, aliases] of Object.entries(mapping)) {
    if (normalizedHeader === field || aliases.some(a => normalizedHeader === a)) {
      return field;
    }
  }
  
  return header;
}

export function normalizeHeaders(headers: string[]): string[] {
  return headers.map(matchHeader);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export function categorizeErrors(errors: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    validation: [],
    duplicate: [],
    database: [],
    format: [],
    other: []
  };
  
  errors.forEach(error => {
    const lower = error.toLowerCase();
    
    if (lower.includes('required') || lower.includes('invalid') || lower.includes('missing')) {
      categories.validation.push(error);
    } else if (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('sudah digunakan')) {
      categories.duplicate.push(error);
    } else if (lower.includes('database') || lower.includes('prisma') || lower.includes('transaction')) {
      categories.database.push(error);
    } else if (lower.includes('format') || lower.includes('parse') || lower.includes('csv')) {
      categories.format.push(error);
    } else {
      categories.other.push(error);
    }
  });
  
  return categories;
}

export function getUserFriendlyError(error: string): string {
  const lower = error.toLowerCase();
  
  if (lower.includes('barcode') && (lower.includes('unique') || lower.includes('duplicate') || lower.includes('sudah digunakan'))) {
    return 'Barcode sudah digunakan oleh produk lain. Silakan gunakan barcode yang berbeda.';
  }
  
  if (lower.includes('product_code') || (lower.includes('sku') && (lower.includes('unique') || lower.includes('duplicate') || lower.includes('sudah digunakan')))) {
    return 'Kode produk (SKU) sudah digunakan. Silakan gunakan kode yang berbeda.';
  }
  
  if (lower.includes('name') && lower.includes('required')) {
    return 'Nama produk wajib diisi.';
  }
  
  if (lower.includes('price') && lower.includes('invalid')) {
    return 'Harga produk tidak valid. Pastikan menggunakan angka positif.';
  }
  
  if (lower.includes('stock') && lower.includes('invalid')) {
    return 'Stok produk tidak valid. Pastikan menggunakan angka non-negatif.';
  }
  
  if (lower.includes('unit') && lower.includes('required')) {
    return 'Satuan produk wajib diisi (contoh: pcs, kg, liter).';
  }
  
  return error;
}

export function sanitizeError(error: string): string {
  return error
    .replace(/password/gi, '***')
    .replace(/token/gi, '***')
    .replace(/secret/gi, '***')
    .replace(/[A-Za-z0-9+/=]{20,}/g, '***');
}
