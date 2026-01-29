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
    padding: 5,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 5,
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 9,
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginVertical: 4,
  },
  metadataContainer: {
    marginTop: 2,
    marginBottom: 5,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
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
    marginTop: 10,
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
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  totalChange?: number; // Added explicit change prop
  discount?: number; // Added discount prop
}

// Komponen PDF Receipt
const ReceiptPDF: React.FC<ReceiptProps> = ({
  invoiceNumber,
  date,
  items,
  payments,
  customerName = '-',
  storeName = 'Rumah Pakan Dwi', // Default fallback
  storeAddress = 'Jl. Lintas Timur, Japura, Inhu, Riau, Indonesia',
  storePhone = '(021) 1234-5678',
  totalChange = 0,
  discount = 0
}) => {
  // Hitung total harga
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // const total = subtotal; // REMOVE OR REUSE

  // Hitung total pembayaran
  const totalPayment = payments.reduce((sum, payment) => sum + payment.amount, 0);

  // Use passed change if available, otherwise calculate (though calculation might be wrong if amount == total)
  // Logic: if totalPayment > total, then change is totalPayment - total.
  // BUT the issue is likely that for CASH, the payment amount recorded IS the TOTAL DUE, not the cash given.
  // CheckoutModal sends:
  // payments: isSplitPayment ? paymentDetails : [{ method: "CASH", amount: total }],
  // So 'amount' is 'total', hence change is 0.
  // We MUST pass the actual cash given OR the calculated change.
  // Let's rely on `totalChange` passed from parent.
  const change = totalChange;

  return (
    <Document>
      <Page size="A6" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{storeName}</Text>
          <Text style={styles.subtitle}>{storeAddress}</Text>
          <Text style={styles.subtitle}>Telp: {storePhone}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metadataContainer}>
          <View style={styles.metadataRow}>
            <Text style={styles.subtitle}>No: {invoiceNumber}</Text>
            <Text style={styles.subtitle}>{date}</Text>
          </View>
          {customerName && customerName !== '-' && (
            <Text style={styles.subtitle}>Plg: {customerName}</Text>
          )}
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
          <View style={styles.summaryRow}>
             <Text style={styles.summaryLabel}>Subtotal</Text>
             <Text style={styles.summaryValue}>{formatIDR(subtotal)}</Text>
          </View>
          {discount > 0 && (
             <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diskon</Text>
                <Text style={styles.summaryValue}>-{formatIDR(discount)}</Text>
             </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Tagihan</Text>
            {/* If discount is passed, use it for checking only. The 'total' calculated from items usually is Gross. 
                Wait, if items have price reduced, then total is already net.
                But usually POS sends original price. 
                Let's assume 'items' has final prices? 
                Actually, CheckoutModal sends items with `item.price` (Selling Price).
                The `discount` is APPLIED ON TOP of the sum.
                So Total = Subtotal - Discount. 
            */}
            <Text style={styles.totalValue}>{formatIDR(Math.max(0, subtotal - discount))}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          {payments.map((payment, index) => (
            <View key={index} style={styles.paymentRow}>
              <Text style={styles.summaryLabel}>Metode: {payment.method}</Text>
              <Text style={styles.summaryValue}>{formatIDR(payment.amount)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          {/* 
            If it's a single CASH payment, showing just "Total Pembayaran" = Price is confusing if we don't show Cash Given.
            However, standard receipt often just shows "CASH: [Payment Amount]".
            If we want to show Cash Given, we need to pass it.
            For now, user complaint is "Change is 0". 
            If I pay 550k for 547k item:
            Items Total: 547k
            Payment: CASH 547k (recorded as sales amount)
            Change: 3k (calculated)
            
            SO:
            Total: 547.000
            CASH: 550.000 (We need to pass the CASH AMOUNT GIVEN, not the bill amount, if we want to show it here)
            Kembalian: 3.000
          */}
          <View style={styles.paymentRow}>
            <Text style={styles.summaryLabel}>Tunai</Text>
            <Text style={styles.summaryValue}>{formatIDR(totalPayment + change)}</Text>
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