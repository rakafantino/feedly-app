// ============================================================================
// TYPES
// ============================================================================

export interface ProductBatch {
    id: string;
    batchNumber?: string | null;
    stock: number;
    expiryDate?: string | null;
    purchasePrice?: number | null;
    inDate: string;
    productId?: string;
    createdAt?: string;
    updatedAt?: string;
    isDeleted?: boolean;
}

export interface BatchDisplayItem {
    id: string;
    batchNumber: string;
    stock: number;
    expiryDate: string | null;
    expiryStatus: 'expired' | 'near' | 'good';
    purchasePrice: string;
    inDate: string;
    statusBadge: {
        label: string;
        variant: 'destructive' | 'secondary' | 'outline';
        className: string;
    };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const NEAR_EXPIRY_DAYS = 30;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_STATUS = {
    EXPIRED: 'expired' as const,
    NEAR: 'near' as const,
    GOOD: 'good' as const
};

export const BADGE_CONFIG = {
    expired: {
        variant: 'destructive' as const,
        label: 'Kadaluarsa',
        className: ''
    },
    near: {
        variant: 'secondary' as const,
        label: 'Hampir Exp',
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
    },
    good: {
        variant: 'outline' as const,
        label: 'Baik',
        className: 'bg-green-50 text-green-700 border-green-200'
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Create empty batch list
 * Pure function - no side effects
 */
export function createEmptyBatchList(): ProductBatch[] {
    return [];
}

/**
 * Create batch display item
 * Pure function - no side effects
 */
export function createBatchDisplayItem(batch: ProductBatch): BatchDisplayItem {
    const status = determineExpiryStatus(batch.expiryDate);
    
    return {
        id: batch.id,
        batchNumber: batch.batchNumber || '-',
        stock: batch.stock,
        expiryDate: batch.expiryDate || null,
        expiryStatus: status,
        purchasePrice: batch.purchasePrice ? formatCurrency(batch.purchasePrice) : '-',
        inDate: formatDateString(batch.inDate),
        statusBadge: BADGE_CONFIG[status]
    };
}

/**
 * Create batch list for display
 * Pure function - no side effects
 */
export function createBatchDisplayList(batches: ProductBatch[]): BatchDisplayItem[] {
    if (!batches || batches.length === 0) {
        return [];
    }
    return batches.map(createBatchDisplayItem);
}

// ============================================================================
// DATE CALCULATIONS
// ============================================================================

/**
 * Parse date string to Date object
 * Pure function - no side effects
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate days until expiry
 * Pure function - no side effects
 */
export function getDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
    const date = parseDate(expiryDate);
    if (!date) return null;
    
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / ONE_DAY_MS);
}

/**
 * Check if batch is expired
 * Pure function - no side effects
 */
export function isExpired(expiryDate: string | null | undefined): boolean {
    const date = parseDate(expiryDate);
    if (!date) return false;
    return date < new Date();
}

/**
 * Check if batch is near expiry
 * Pure function - no side effects
 */
export function isNearExpiry(expiryDate: string | null | undefined): boolean {
    const days = getDaysUntilExpiry(expiryDate);
    if (days === null) return false;
    return days > 0 && days <= NEAR_EXPIRY_DAYS;
}

/**
 * Determine expiry status
 * Pure function - no side effects
 */
export function determineExpiryStatus(expiryDate: string | null | undefined): 'expired' | 'near' | 'good' {
    if (isExpired(expiryDate)) {
        return EXPIRY_STATUS.EXPIRED;
    }
    if (isNearExpiry(expiryDate)) {
        return EXPIRY_STATUS.NEAR;
    }
    return EXPIRY_STATUS.GOOD;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format currency
 * Pure function - no side effects
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Format date string for display
 * Pure function - no side effects
 */
export function formatDateString(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Format expiry date for display
 * Pure function - no side effects
 */
export function formatExpiryDate(expiryDate: string | null | undefined): string {
    const date = parseDate(expiryDate);
    if (!date) return '-';
    return formatDateString(dateStrToIso(expiryDate || ''));
}

/**
 * Convert date string to ISO format
 * Pure function - no side effects
 */
export function dateStrToIso(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toISOString();
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Check if batch list is empty
 * Pure function - no side effects
 */
export function isBatchListEmpty(batches: ProductBatch[] | null | undefined): boolean {
    return !batches || batches.length === 0;
}

/**
 * Filter active batches
 * Pure function - no side effects
 */
export function filterActiveBatches(batches: ProductBatch[]): ProductBatch[] {
    return batches.filter(batch => !batch.isDeleted);
}

/**
 * Filter expired batches
 * Pure function - no side effects
 */
export function filterExpiredBatches(batches: ProductBatch[]): ProductBatch[] {
    return batches.filter(batch => isExpired(batch.expiryDate));
}

/**
 * Filter near expiry batches
 * Pure function - no side effects
 */
export function filterNearExpiryBatches(batches: ProductBatch[]): ProductBatch[] {
    return batches.filter(batch => isNearExpiry(batch.expiryDate) && !isExpired(batch.expiryDate));
}

/**
 * Get total stock from batches
 * Pure function - no side effects
 */
export function getTotalStock(batches: ProductBatch[]): number {
    return batches.reduce((sum, batch) => sum + (batch.stock || 0), 0);
}

/**
 * Sort batches by expiry date
 * Pure function - no side effects
 */
export function sortBatchesByExpiry(batches: ProductBatch[], ascending: boolean = true): ProductBatch[] {
    return [...batches].sort((a, b) => {
        const dateA = parseDate(a.expiryDate)?.getTime() || Infinity;
        const dateB = parseDate(b.expiryDate)?.getTime() || Infinity;
        return ascending ? dateA - dateB : dateB - dateA;
    });
}

// ============================================================================
// COMPARISON
// ============================================================================

/**
 * Check if batch has changed
 * Pure function - no side effects
 */
export function hasBatchChanged(original: ProductBatch, current: ProductBatch): boolean {
    return (
        original.stock !== current.stock ||
        original.batchNumber !== current.batchNumber ||
        original.expiryDate !== current.expiryDate ||
        original.purchasePrice !== current.purchasePrice
    );
}

/**
 * Find batch by ID
 * Pure function - no side effects
 */
export function findBatchById(batches: ProductBatch[], id: string): ProductBatch | undefined {
    return batches.find(batch => batch.id === id);
}

/**
 * Check if batch exists
 * Pure function - no side effects
 */
export function batchExists(batches: ProductBatch[], id: string): boolean {
    return batches.some(batch => batch.id === id);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate batch data
 * Pure function - no side effects
 */
export function validateBatch(batch: Partial<ProductBatch>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!batch.id) {
        errors.push('Batch ID wajib diisi');
    }
    
    if (batch.stock === undefined || batch.stock === null) {
        errors.push('Stok wajib diisi');
    } else if (batch.stock < 0) {
        errors.push('Stok tidak boleh negatif');
    }
    
    if (!batch.inDate) {
        errors.push('Tanggal masuk wajib diisi');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate batch list
 * Pure function - no side effects
 */
export function validateBatchList(batches: ProductBatch[]): { valid: boolean; totalErrors: number } {
    let totalErrors = 0;
    batches.forEach(batch => {
        const result = validateBatch(batch);
        if (!result.valid) {
            totalErrors += result.errors.length;
        }
    });
    return {
        valid: totalErrors === 0,
        totalErrors
    };
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Get batch summary
 * Pure function - no side effects
 */
export function getBatchSummary(batches: ProductBatch[]): {
    total: number;
    expired: number;
    nearExpiry: number;
    good: number;
    totalStock: number;
} {
    const expired = filterExpiredBatches(batches);
    const near = filterNearExpiryBatches(batches);
    const good = batches.filter(b => determineExpiryStatus(b.expiryDate) === 'good');
    
    return {
        total: batches.length,
        expired: expired.length,
        nearExpiry: near.length,
        good: good.length,
        totalStock: getTotalStock(batches)
    };
}

/**
 * Format batch summary for display
 * Pure function - no side effects
 */
export function formatBatchSummary(batches: ProductBatch[]): string {
    const summary = getBatchSummary(batches);
    return `Total: ${summary.total} | Expired: ${summary.expired} | Hampir Exp: ${summary.nearExpiry} | Baik: ${summary.good} | Stok: ${summary.totalStock}`;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Prepare batches for export
 * Pure function - no side effects
 */
export function prepareBatchesExport(batches: ProductBatch[]): Array<Record<string, string>> {
    return batches.map(batch => ({
        'No. Batch': batch.batchNumber || '-',
        'Stok': String(batch.stock || 0),
        'Kadaluarsa': batch.expiryDate || '-',
        'Harga Beli': batch.purchasePrice ? formatCurrency(batch.purchasePrice) : '-',
        'Tgl Masuk': formatDateString(batch.inDate),
        'Status': determineExpiryStatus(batch.expiryDate).toUpperCase()
    }));
}

/**
 * Get table headers
 * Pure function - no side effects
 */
export function getTableHeaders(): string[] {
    return [
        'No. Batch',
        'Stok',
        'Kadaluarsa',
        'Harga Beli',
        'Tgl Masuk',
        'Status'
    ];
}

/**
 * Get badge variant
 * Pure function - no side effects
 */
export function getBadgeVariant(status: 'expired' | 'near' | 'good'): 'destructive' | 'secondary' | 'outline' {
    return BADGE_CONFIG[status].variant;
}

/**
 * Get badge label
 * Pure function - no side effects
 */
export function getBadgeLabel(status: 'expired' | 'near' | 'good'): string {
    return BADGE_CONFIG[status].label;
}
