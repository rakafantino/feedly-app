import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  PDFViewer,
  Image
} from '@react-pdf/renderer';
import { CartItem } from '@/lib/store';
import { formatIDR } from '@/lib/utils';

// Membuat styles untuk PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 10,
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 15,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginVertical: 10,
  },
  section: {
    margin: 10,
    padding: 10,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
  },
  tableRowHeader: {
    backgroundColor: '#f0f0f0',
  },
  tableCol: {
    padding: 5,
  },
  tableCell: {
    fontSize: 10,
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  col1: {
    width: '40%',
  },
  col2: {
    width: '15%',
    textAlign: 'right',
  },
  col3: {
    width: '20%',
    textAlign: 'right',
  },
  col4: {
    width: '25%',
    textAlign: 'right',
  },
  summarySection: {
    marginTop: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    fontSize: 10,
    textAlign: 'center',
  },
  paymentSection: {
    marginTop: 15,
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
});

export interface ReceiptProps {
  invoiceNumber: string;
  date: string;
  items: CartItem[];
  payments: {
    method: string;
    amount: number;
  }[];
  customerName?: string;
}

// Komponen PDF Receipt
const ReceiptPDF: React.FC<ReceiptProps> = ({ 
  invoiceNumber, 
  date, 
  items, 
  payments,
  customerName = '-'
}) => {
  // Hitung total harga
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;
  
  // Hitung total pembayaran
  const totalPayment = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Hitung kembalian
  const change = totalPayment - total;

  return (
    <Document>
      <Page size="A6" style={styles.page}>
        <View style={styles.header}>
          <Image 
            style={styles.logo} 
            src="/globe.svg" 
          />
          <Text style={styles.title}>Toko Pakan Ternak</Text>
          <Text style={styles.subtitle}>Jl. Contoh No. 123, Kota, Indonesia</Text>
          <Text style={styles.subtitle}>Telp: (021) 1234-5678</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View>
          <Text style={styles.subtitle}>No. Invoice: {invoiceNumber}</Text>
          <Text style={styles.subtitle}>Tanggal: {date}</Text>
          <Text style={styles.subtitle}>Pelanggan: {customerName}</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableRowHeader]}>
            <View style={[styles.tableCol, styles.col1]}>
              <Text style={styles.tableCellHeader}>Item</Text>
            </View>
            <View style={[styles.tableCol, styles.col2]}>
              <Text style={styles.tableCellHeader}>Qty</Text>
            </View>
            <View style={[styles.tableCol, styles.col3]}>
              <Text style={styles.tableCellHeader}>Harga</Text>
            </View>
            <View style={[styles.tableCol, styles.col4]}>
              <Text style={styles.tableCellHeader}>Subtotal</Text>
            </View>
          </View>
          
          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={[styles.tableCol, styles.col1]}>
                <Text style={styles.tableCell}>{item.name}</Text>
              </View>
              <View style={[styles.tableCol, styles.col2]}>
                <Text style={styles.tableCell}>{item.quantity}</Text>
              </View>
              <View style={[styles.tableCol, styles.col3]}>
                <Text style={styles.tableCell}>{formatIDR(item.price)}</Text>
              </View>
              <View style={[styles.tableCol, styles.col4]}>
                <Text style={styles.tableCell}>{formatIDR(item.price * item.quantity)}</Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={styles.summarySection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatIDR(total)}</Text>
          </View>
        </View>
        
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Informasi Pembayaran</Text>
          {payments.map((payment, index) => (
            <View key={index} style={styles.paymentRow}>
              <Text style={styles.summaryLabel}>{payment.method}</Text>
              <Text style={styles.summaryValue}>{formatIDR(payment.amount)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.paymentRow}>
            <Text style={styles.summaryLabel}>Total Pembayaran</Text>
            <Text style={styles.summaryValue}>{formatIDR(totalPayment)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.summaryLabel}>Kembalian</Text>
            <Text style={styles.summaryValue}>{formatIDR(change)}</Text>
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text>Terima kasih atas kunjungan Anda!</Text>
          <Text>Barang yang sudah dibeli tidak dapat dikembalikan.</Text>
        </View>
      </Page>
    </Document>
  );
};

// Komponen untuk menampilkan PDF di browser
const ReceiptPreview: React.FC<ReceiptProps> = (props) => {
  return (
    <PDFViewer width="100%" height="600px">
      <ReceiptPDF {...props} />
    </PDFViewer>
  );
};

// Ekspor komponen
export { ReceiptPDF, ReceiptPreview }; 