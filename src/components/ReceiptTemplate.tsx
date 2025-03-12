import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  PDFViewer,
  PDFDownloadLink,
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
          <Text style={styles.title}>Rumah Pakan Dwi</Text>
          <Text style={styles.subtitle}>Jl. Lintas Timur, Japura, Inhu, Riau, Indonesia</Text>
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

// Komponen untuk menampilkan PDF di browser dengan responsif
const ReceiptPreview: React.FC<ReceiptProps> = (props) => {
  // Deteksi perangkat mobile
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    // Simple mobile detection
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileCheck = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4));
      setIsMobile(isMobileCheck);
    };
    
    checkMobile();
  }, []);

  if (isMobile) {
    return (
      <div className="py-4 flex flex-col items-center">
        <div className="mb-4 text-center">
          <h3 className="text-base font-medium">Struk berhasil dibuat!</h3>
          <p className="text-sm text-muted-foreground">Silakan unduh struk pembayaran.</p>
        </div>
        <PDFDownloadLink 
          document={<ReceiptPDF {...props} />} 
          fileName={`Receipt-${props.invoiceNumber}.pdf`}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full max-w-xs"
        >
          {({ loading }) => loading ? 'Loading...' : 'Unduh Struk (PDF)'}
        </PDFDownloadLink>
      </div>
    );
  }

  return (
    <PDFViewer width="100%" height="600px">
      <ReceiptPDF {...props} />
    </PDFViewer>
  );
};

// Ekspor komponen
export { ReceiptPDF, ReceiptPreview }; 