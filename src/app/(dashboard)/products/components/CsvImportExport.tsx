"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, AlertCircle, Loader2, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface CsvImportExportProps {
  onRefresh: () => void;
}

export function CsvImportExport({ onRefresh }: CsvImportExportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/products/export');
      if (!response.ok) {
        throw new Error('Failed to export products');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Data produk berhasil diekspor');
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Gagal mengekspor data produk');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error('Tidak ada file yang dipilih');
      return;
    }
    
    // Validate file is CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Hanya file CSV yang diperbolehkan');
      return;
    }
    
    // Validasi ukuran file (maksimal 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Ukuran file terlalu besar (maks. 5MB)`);
      return;
    }
    
    // Validasi nama file (tidak boleh ada karakter khusus yang mungkin bermasalah)
    if (/[^\w\s.-]/gi.test(file.name.replace('.csv', ''))) {
      toast.warning('Nama file mungkin mengandung karakter khusus yang dapat menyebabkan masalah');
    }
    
    toast.info(`Memproses file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    setCsvFile(file);
    
    // Preview the CSV
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        if (!event.target?.result) {
          toast.error('Gagal membaca file (hasil kosong)');
          return;
        }
        
        const csvText = event.target.result as string;
        console.log('CSV content length:', csvText.length);
        
        if (!csvText || csvText.trim() === '') {
          toast.error('File CSV kosong');
          return;
        }
        
        const lines = csvText.split('\n');
        console.log('CSV lines count:', lines.length);
        
        if (lines.length < 2) {
          toast.error('File CSV tidak valid (kurang dari 2 baris)');
          return;
        }
        
        // Kemungkinan baris pertama adalah komentar, lewati jika diawali #
        let headerRow = 0;
        if (lines[0].trim().startsWith('#')) {
          headerRow = 1;
          if (lines.length < 3) { // Header + minimal 1 data
            toast.error('File CSV tidak memiliki cukup data');
            return;
          }
        }
        
        // Parse headers
        const headerLine = lines[headerRow].trim();
        if (!headerLine) {
          toast.error('Baris header CSV kosong');
          return;
        }
        
        const headers = headerLine.split(',').map(h => {
          // Bersihkan quotes jika ada
          let header = h.trim();
          if (header.startsWith('"') && header.endsWith('"')) {
            header = header.substring(1, header.length - 1);
          }
          return header;
        });
        
        console.log('CSV headers:', headers);
        
        // Check required headers
        const requiredHeaders = ['name', 'price', 'stock', 'unit'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setImportErrors([`Header berikut tidak ditemukan: ${missingHeaders.join(', ')}`]);
          setShowImportDialog(true); // Show dialog even with errors
          return;
        }
        
        // Parse preview data (skip header row and comments)
        const dataStartRow = headerRow + 1;
        const previewEndRow = Math.min(dataStartRow + 5, lines.length);
        
        console.log(`Parsing preview data rows ${dataStartRow} to ${previewEndRow-1}`);
        
        const previewRows = lines.slice(dataStartRow, previewEndRow)
          .filter(line => line.trim() !== '')
          .map(line => {
            try {
              // Use our CSV parser for better accuracy
              const values = parseCSVLine(line);
              if (values.length !== headers.length) {
                console.warn(`Column count mismatch: expected ${headers.length}, got ${values.length}`);
              }
              
              const row: Record<string, string> = {};
              headers.forEach((header, index) => {
                row[header] = index < values.length ? values[index] : '';
              });
              return row;
            } catch (err) {
              console.error('Error parsing CSV line:', line, err);
              // Return a minimal row to avoid breaking the preview
              const fallbackRow: Record<string, string> = {};
              headers.forEach(header => {
                fallbackRow[header] = '';
              });
              return fallbackRow;
            }
          });
        
        console.log('Preview rows:', previewRows);
        
        if (previewRows.length === 0) {
          toast.error('Tidak ada data yang valid untuk di-preview');
          return;
        }
        
        setPreviewData(previewRows);
        setImportErrors([]);
        setShowImportDialog(true);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error(`Format CSV tidak valid: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setImportErrors(['Format CSV tidak valid']);
        setShowImportDialog(true); // Show dialog with errors
      }
    };
    
    reader.onerror = () => {
      console.error('FileReader error:', reader.error);
      toast.error(`Error membaca file: ${reader.error?.message || 'Unknown error'}`);
    };
    
    reader.readAsText(file);
  };

  // Helper function to parse CSV lines considering quotes
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // If next character is also quote, it's an escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next character
        } else {
          // Toggle inQuotes status
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Comma outside quotes marks a new column
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last column
    result.push(current);
    
    return result;
  }

  const handleImportConfirm = async () => {
    if (!csvFile) return;
    
    setIsImporting(true);
    setShowImportDialog(false);
    
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import products');
      }
      
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        setConfirmDialogOpen(true);
      } else {
        toast.success(`${result.imported} produk berhasil diimpor`);
        onRefresh();
      }
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Gagal mengimpor data produk: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
      setCsvFile(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Export Button */}
      <Button 
        variant="outline" 
        className="flex items-center gap-2" 
        onClick={handleExportCsv}
        disabled={isExporting}
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export CSV
      </Button>
      
      {/* Import Button and File Input */}
      <div className="relative">
        <Button 
          variant="outline" 
          className="flex items-center gap-2" 
          onClick={() => document.getElementById('csv-file-input')?.click()}
          disabled={isImporting}
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import CSV
        </Button>
        <input 
          type="file" 
          id="csv-file-input" 
          accept=".csv" 
          className="hidden" 
          onChange={handleFileChange}
          disabled={isImporting}
        />
      </div>
      
      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview Import CSV</DialogTitle>
            <DialogDescription>
              Berikut adalah preview dari 5 baris pertama data yang akan diimpor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {importErrors.length > 0 ? (
              <div className="bg-destructive/20 p-3 rounded-md mb-4">
                <div className="font-semibold flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Error pada file CSV
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {importErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border rounded max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 sticky top-0">
                        {previewData.length > 0 && 
                          Object.keys(previewData[0]).map((header) => (
                            <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                              {header}
                            </th>
                          ))
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-muted/20">
                          {Object.values(row).map((value, j) => (
                            <td key={j} className="px-3 py-2 whitespace-nowrap">
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                    Batal
                  </Button>
                  <Button onClick={handleImportConfirm}>
                    Import Data
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Dialog for Import with Errors */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import CSV Berhasil dengan Warning</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <div className="bg-yellow-50 p-3 rounded-md">
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span>Beberapa item gagal diimpor</span>
                  </div>
                  
                  {importErrors.length > 10 ? (
                    <>
                      <p className="text-sm mb-2">Terdapat {importErrors.length} error:</p>
                      <div className="max-h-40 overflow-y-auto border border-yellow-200 rounded p-2 bg-white">
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          {importErrors.slice(0, 10).map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                          <li className="font-semibold">... dan {importErrors.length - 10} error lainnya</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {importErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
                
                <div className="bg-green-50 p-3 rounded-md">
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Item yang valid telah berhasil diimpor</span>
                  </div>
                  <p className="text-sm">Import selesai dengan {importErrors.length} warning. Silakan periksa data Anda.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setConfirmDialogOpen(false);
              onRefresh();
            }}>
              Oke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* CSV Template Link */}
      <Button 
        variant="link" 
        className="ml-2 text-xs" 
        onClick={() => window.open('/api/products/template', '_blank')}
      >
        <FileSpreadsheet className="h-3 w-3 mr-1" />
        Download Template
      </Button>
    </div>
  );
} 