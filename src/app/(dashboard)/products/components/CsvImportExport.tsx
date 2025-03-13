"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
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
    if (!file) return;
    
    // Validate file is CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Hanya file CSV yang diperbolehkan');
      return;
    }
    
    setCsvFile(file);
    
    // Preview the CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Check required headers
        const requiredHeaders = ['name', 'price', 'stock', 'unit'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setImportErrors([`Header berikut tidak ditemukan: ${missingHeaders.join(', ')}`]);
          return;
        }
        
        // Parse preview data (first 5 rows)
        const previewRows = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        
        setPreviewData(previewRows);
        setImportErrors([]);
        setShowImportDialog(true);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setImportErrors(['Format CSV tidak valid']);
      }
    };
    reader.readAsText(file);
  };

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
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import products');
      }
      
      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        setConfirmDialogOpen(true);
      } else {
        toast.success(`${result.imported} produk berhasil diimpor`);
        onRefresh();
      }
    } catch (error) {
      console.error('Error importing products:', error);
      toast.error('Gagal mengimpor data produk');
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
        <DialogContent className="max-w-2xl">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        {previewData.length > 0 && 
                          Object.keys(previewData[0]).map((header) => (
                            <th key={header} className="px-2 py-2 text-xs text-left font-medium">
                              {header}
                            </th>
                          ))
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b">
                          {Object.values(row).map((value, j) => (
                            <td key={j} className="px-2 py-2 text-xs">
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
              <div className="bg-yellow-50 p-3 rounded-md mb-4">
                <div className="font-semibold flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Beberapa item gagal diimpor
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {importErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
              <p>Item yang valid telah berhasil diimpor.</p>
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