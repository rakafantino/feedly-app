# Panduan Migrasi ke Multi-Toko

Berikut adalah langkah-langkah untuk migrasi dari aplikasi satu toko menjadi multi-toko:

## 1. Buat Migrasi Prisma

Jalankan perintah berikut untuk membuat migrasi database:

```bash
npx prisma migrate dev --name add-store-model
```

## 2. Jalankan Script Migrasi

Script migrasi akan membuat toko default dan menghubungkan semua data yang ada ke toko tersebut:

```bash
npx ts-node prisma/migrate-to-multi-store.ts
```

## 3. Restart Aplikasi

Restart aplikasi untuk menerapkan perubahan:

```bash
npm run dev
```

## 4. Login dan Coba Fitur Multi-Toko

- Login sebagai admin
- Buat toko baru dari halaman admin
- Tambahkan pengguna ke toko yang berbeda
- Uji fitur ganti toko

## Catatan Penting

- Pastikan backup database sebelum melakukan migrasi
- Jika terjadi error, jalankan `npx prisma db push --force-reset` untuk me-reset database (HATI-HATI: ini akan menghapus semua data)
