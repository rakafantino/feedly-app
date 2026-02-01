"use client";

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Icon */}
      <div style={{
        fontSize: '64px',
        marginBottom: '1.5rem',
      }}>
        📡
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#333',
        marginBottom: '1rem',
      }}>
        Anda Sedang Offline
      </h1>

      {/* Description */}
      <p style={{
        fontSize: '1.1rem',
        color: '#666',
        maxWidth: '400px',
        marginBottom: '2rem',
        lineHeight: '1.6',
      }}>
        Sepertinya koneksi internet terputus. Tenang, aplikasi Feedly tetap bisa 
        digunakan untuk melihat data yang sudah tersimpan dan mengantrikan transaksi.
      </p>

      {/* Status Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h2 style={{
          fontSize: '1rem',
          fontWeight: '600',
          color: '#4CAF50',
          marginBottom: '1rem',
        }}>
          Fitur yang Tersedia Offline:
        </h2>
        <ul style={{
          textAlign: 'left',
          color: '#555',
          lineHeight: '2',
          paddingLeft: '1.5rem',
        }}>
          <li>✓ Melihat daftar produk dan stok</li>
          <li>✓ Melihat data pelanggan dan supplier</li>
          <li>✓ Melihat riwayat transaksi</li>
          <li>✓ Mencatat transaksi penjualan (diantrikan)</li>
          <li>✓ Menambahkan produk baru (diantrikan)</li>
        </ul>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: 'white',
            backgroundColor: '#4CAF50',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          🔄 Coba Lagi
        </button>

        <Link
          href="/"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#4CAF50',
            backgroundColor: 'white',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          🏠 Ke Dashboard
        </Link>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: '3rem',
        fontSize: '0.875rem',
        color: '#999',
      }}>
        Transaksi yang dicatat saat offline akan disinkronkan secara otomatis 
        saat koneksi kembali.
      </p>
    </div>
  );
}
