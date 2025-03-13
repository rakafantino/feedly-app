"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, FileSpreadsheet, AlertCircle, Loader2, Check, ChevronDown } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CsvImportExportProps {
  onRefresh: () => void;
  showAsDropdown?: boolean;
}

export function CsvImportExport({ onRefresh, showAsDropdown = false }: CsvImportExportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
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
    
    // Langsung import tanpa preview
    importCsvFile(file);
  };

  const importCsvFile = async (file: File) => {
    setIsImporting(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
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
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/products/template', '_blank');
  };

  // Di layar mobile tampilkan sebagai dropdown menu
  if (showAsDropdown) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full flex justify-between items-center">
              <span>CSV Options</span>
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={handleExportCsv} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.getElementById('csv-file-input-mobile')?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : "Import CSV"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input 
          type="file" 
          id="csv-file-input-mobile"
          accept=".csv" 
          className="hidden" 
          onChange={handleFileChange}
          disabled={isImporting}
        />
        
        <ImportErrorDialog 
          open={confirmDialogOpen} 
          onOpenChange={setConfirmDialogOpen}
          importErrors={importErrors}
          onConfirm={() => {
            setConfirmDialogOpen(false);
            onRefresh();
          }}
        />
      </>
    );
  }

  // Di layar desktop tampilkan sebagai tombol
  return (
    <>
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
        
        {/* CSV Template Link */}
        <Button 
          variant="link" 
          className="text-xs" 
          onClick={handleDownloadTemplate}
        >
          <FileSpreadsheet className="h-3 w-3 mr-1" />
          Download Template
        </Button>
      </div>
      
      <ImportErrorDialog 
        open={confirmDialogOpen} 
        onOpenChange={setConfirmDialogOpen}
        importErrors={importErrors}
        onConfirm={() => {
          setConfirmDialogOpen(false);
          onRefresh();
        }}
      />
    </>
  );
}

// Separate component for the import error dialog to avoid duplication
function ImportErrorDialog({ 
  open, 
  onOpenChange,
  importErrors,
  onConfirm
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  importErrors: string[];
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import CSV Berhasil dengan Warning</AlertDialogTitle>
        </AlertDialogHeader>
        
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="bg-yellow-50 p-3 rounded-md">
            <div className="font-semibold flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Beberapa item gagal diimpor</span>
            </div>
            
            {importErrors.length > 10 ? (
              <>
                <div className="text-sm mb-2">Terdapat {importErrors.length} error:</div>
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
            <div className="text-sm">Import selesai dengan {importErrors.length} warning. Silakan periksa data Anda.</div>
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>
            Oke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 