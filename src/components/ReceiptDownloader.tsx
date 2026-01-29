import React from 'react';
import { Button } from '@/components/ui/button';
import { ReceiptPDF, ReceiptProps } from './ReceiptTemplate';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';

// Fungsi untuk menghasilkan nomor invoice
export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2); // Ambil 2 digit tahun
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Bulan (01-12)
  const day = date.getDate().toString().padStart(2, '0'); // Tanggal (01-31)
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 4 digit random

  return `INV/${year}${month}${day}/${random}`;
}

// Fungsi untuk mendapatkan tanggal dan waktu saat ini
export function getCurrentDateTime(): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  return new Intl.DateTimeFormat('id-ID', options).format(new Date());
}

interface ReceiptDownloaderProps {
  receipt: Omit<ReceiptProps, 'invoiceNumber' | 'date'>;
  fileName?: string;
}

const ReceiptDownloader: React.FC<ReceiptDownloaderProps> = ({
  receipt,
  fileName = 'receipt.pdf'
}) => {
  // Generate invoice dan tanggal
  const invoiceNumber = generateInvoiceNumber();
  const date = getCurrentDateTime();

  // Lengkapi data receipt
  const completeReceipt: ReceiptProps = {
    ...receipt,
    invoiceNumber,
    date,
    storeName: receipt.storeName,
    storeAddress: receipt.storeAddress,
    storePhone: receipt.storePhone,
    totalChange: receipt.totalChange,
    discount: receipt.discount
  };

  return (
    <PDFDownloadLink
      document={<ReceiptPDF {...completeReceipt} />}
      fileName={fileName}
      style={{ textDecoration: 'none' }}
      className="w-full sm:w-auto"
    >
      {({ loading }) => (
        <Button disabled={loading} className="w-full sm:w-auto">
          {loading ? 'Memuat PDF...' : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Unduh Struk
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
};

export default ReceiptDownloader; 