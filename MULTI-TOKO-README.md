# Fitur Multi-Toko pada Aplikasi POS

## Pengantar

Aplikasi POS ini sekarang mendukung fitur multi-toko, yang memungkinkan Anda untuk:

1. Membuat dan mengelola beberapa toko dalam satu instalasi aplikasi
2. Menentukan pengguna mana yang memiliki akses ke toko tertentu
3. Memisahkan data (produk, transaksi, supplier) antar toko
4. Administrator dapat mengakses dan mengelola semua toko

## Cara Kerja

### Peran Pengguna

- **ADMIN**: Dapat mengakses semua toko dan mengelola toko dan pengguna
- **MANAGER**: Hanya dapat mengakses toko yang telah ditentukan
- **CASHIER**: Hanya dapat mengakses toko yang telah ditentukan

### Alur Pengguna

1. Pengguna login dengan email dan password
2. Sistem memeriksa apakah pengguna memiliki akses ke toko tertentu
3. Jika pengguna memiliki akses ke beberapa toko, mereka akan diarahkan ke halaman pemilihan toko
4. Setelah memilih toko, semua data yang ditampilkan dan diedit hanya berlaku untuk toko tersebut

## Fitur Administratif

### Manajemen Toko

Admin dapat:

- Melihat daftar semua toko (`GET /api/stores`)
- Membuat toko baru (`POST /api/stores`)
- Mengedit informasi toko (`PUT /api/stores/[id]`)
- Menonaktifkan/mengaktifkan toko (`PATCH /api/stores/[id]/toggle-active`)

### Manajemen Pengguna

Admin dapat:

- Menambahkan pengguna ke toko tertentu (`POST /api/stores/[id]/users`)
- Melihat pengguna dalam toko tertentu (`GET /api/stores/[id]/users`)
- Mengubah toko pengguna (`PATCH /api/users/[id]/store`)

### Pemilihan Toko

Semua pengguna dapat:

- Melihat toko yang dapat mereka akses (`GET /api/stores/user-stores`)
- Memilih toko untuk sesi saat ini (`POST /api/stores/select-store`)

## Implementasi Teknis

### Mekanisme Filter Data

Semua endpoint API yang menangani data toko-spesifik (produk, transaksi, supplier) harus menyertakan filter `storeId` saat melakukan kueri database. API middleware memastikan bahwa:

1. Pengguna hanya bisa mengakses data dari toko yang mereka miliki akses
2. Admin dapat mengakses data dari semua toko
3. Pengguna dapat beralih antar toko jika memiliki akses ke beberapa toko

### Context dan State Management

Front-end aplikasi menggunakan:

- `StoreProvider` yang menyimpan `storeId` dan `storeName` saat ini
- Dropdown pemilihan toko di header untuk beralih antar toko
- Filter storeId untuk semua permintaan API

## Panduan Pengembangan Lebih Lanjut

Ketika menambahkan fitur baru:

1. Pastikan semua model database baru memiliki relasi dengan model `Store`
2. Tambahkan filter `storeId` pada semua fungsi yang mengambil atau memanipulasi data
3. Gunakan fungsi `withAuth` dari `api-middleware.ts` yang secara otomatis menyediakan storeId
4. Tambahkan validasi akses toko menggunakan fungsi `hasStoreAccess`

Selamat, aplikasi Anda sekarang mendukung multi-toko!
