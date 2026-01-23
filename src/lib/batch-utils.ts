/**
 * Generates a batch number based on current date, supplier info, and a random sequence.
 * Format: YYMMDD-[SupplierCode]-[Random]
 * 
 * @param supplierName - Optional supplier name to derive code from
 * @param supplierCode - Optional existing supplier code
 * @returns string - The generated batch number
 */
export const generateBatchNumber = (supplierName?: string, supplierCode?: string): string => {
  // Get current date in YYMMDD format
  const today = new Date();
  const dateStr = today.getFullYear().toString().substr(-2) +
    (today.getMonth() + 1).toString().padStart(2, '0') +
    today.getDate().toString().padStart(2, '0');

  let code = "XX";
  
  if (supplierCode) {
    code = supplierCode.toUpperCase();
  } else if (supplierName) {
    // Remove common prefixes
    const cleanName = supplierName
      .replace(/^(PT|CV|UD|TB|TOKO)\.?\s+/i, "")
      .trim();

    // Get first letters of each word
    const words = cleanName.split(" ");
    if (words.length >= 3) {
      code = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else if (words.length === 2) {
      code = (words[0][0] + words[1][0]).toUpperCase();
    } else {
      code = cleanName.substring(0, 3).toUpperCase();
    }
  }

  // Random 3-digit sequence
  const sequence = Math.floor(Math.random() * 900 + 100).toString();

  // Format: YYMMDD-SP-123
  return `${dateStr}-${code}-${sequence}`;
};
