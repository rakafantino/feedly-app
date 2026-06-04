# Feedly App Codebase Audit Fixes & Safe Refactoring Plan

## 1. Goal
Menyelesaikan hutang teknis (technical debt) yang ditemukan saat audit berdasarkan *Feedly App Codebase Rules*, dengan **prioritas absolut** pada pelestarian fungsionalitas (zero behavior change), terutama saat melakukan pemindahan *business logic* dari API Route ke Core layer.

## 2. Current Context & Constraints
- Aplikasi saat ini berjalan sangat mulus (smooth) di *production/development*.
- Ditemukan 25 failing tests (di finance.service, purchase-orders API, products API, dll).
- Ditemukan 55 penggunaan `any` di `src/core`.
- Ada peringatan linter terkait `eslint-disable`.
- Coverage di beberapa bagian core logic masih rendah.
- Terdapat business logic yang cukup berat (seperti kalkulasi stok/harga/receive goods) di dalam `src/app/api/route.ts` (Imperative Shell), yang melanggar prinsip FCIS (Functional Core, Imperative Shell).

**CONSTRAINT UTAMA (NON-NEGOTIABLE):**
Fungsionalitas 100% tidak boleh berubah. Proses refactor tidak boleh mengubah hasil (output), payload response, format error, atau side-effect ke database.

## 3. Proposed Approach & Step-by-Step Plan

Kita akan menggunakan pendekatan yang sangat defensif (Defensive Refactoring) dengan siklus **Test-First**.

### Phase 1: Stabilisasi Fondasi (Fix Failing Tests)
*Sebelum menyentuh refactor arsitektur, kita pastikan semua test saat ini berstatus PASS.*
1. **Fix `finance.service.test.ts`**:
   - Analisa kenapa `adjustments is not iterable`. Kemungkinan mock data prisma tidak mengembalikan array, atau ada perubahan skema yang belum ter-mocking dengan benar.
   - Perbaiki mock/logic agar test pass.
2. **Fix `purchase-orders/[id]/route.test.ts`**:
   - Perbaiki `TypeError: tx.productBatch.updateMany is not a function` dan `Cannot read properties of undefined (reading 'reduce')`.
   - Pastikan transaksi prisma (`$transaction`) di-mock dengan benar di environment test.
3. **Fix API tests lainnya** (`products`, `inventory`, `suppliers`, `customers`, `forgot-password`, `dashboard`).
4. **Verifikasi Phase 1**: Jalankan `npx jest`. Wajib 100% PASS sebelum lanjut ke Phase 2.

### Phase 2: Pembersihan Code Quality (Linter & Types)
1. Hapus komentar `eslint-disable` yang *unused* di `custom-route.test.ts`.
2. Lakukan audit pada file-file di `src/core/` yang menggunakan tipe `any` atau `as unknown as T`.
3. Ganti tipe-tipe *loose* tersebut dengan interface/type deklaratif dari `src/types/`. Jika memang tipe data dinamis, gunakan `unknown` dan *type-guards* (Zod validation / typeof).
4. **Verifikasi Phase 2**: `npm run lint` dan `npm run type-check` wajib lolos tanpa warning.

### Phase 3: Coverage Push (Proteksi sebelum Refactor)
*Ini adalah langkah krusial untuk menjamin fungsionalitas Point 4 tidak berubah.*
1. Identifikasi *API Routes* yang akan di-refactor (contoh: `purchase-orders`).
2. Sebelum memindahkan logic apapun, pastikan coverage test untuk route tersebut sudah 100%.
3. Tulis *Characterization Tests* (Test yang merekam output saat ini apa adanya) untuk menangkap edge-cases (input salah, input kosong, validasi).
4. Tambahkan unit test untuk `notificationService.ts` dan `stock-utils.ts` agar coverage naik ke angka yang lebih aman.

### Phase 4: Safe Refactoring (Route Logic -> Core Layer)
*Langkah ini dilakukan HANYA JIKA Phase 1, 2, dan 3 sudah beres.*
1. **Isolasi Logic**: Buat fungsi baru di `src/core/` (misal: `src/core/purchase-orders/receive-goods.core.ts`).
2. **Copy-Paste (Bukan Cut-Paste)**: Salin logic kalkulasi dan transformasi data dari API Route ke fungsi Core baru tersebut. Fungsi Core HANYA menerima input (parameter) murni dan mereturn object hasil (State kalkulasi), TANPA memanggil `prisma` atau `NextResponse` di dalamnya.
3. **Test Core Baru**: Buat Unit Test untuk fungsi Core yang baru dipisah. Pastikan return value-nya persis dengan kalkulasi di API Route lama.
4. **Wiring (Pengkabelan)**: Modifikasi file API Route (`src/app/api/.../route.ts`). API Route kini hanya bertugas:
   - Terima Request
   - Ekstrak Body/Params
   - Panggil fungsi di `src/core/`
   - Gunakan kembalian fungsi Core untuk memanggil `prisma` (Database).
   - Return `NextResponse`.
5. **Regression Check**: Jalankan kembali *seluruh test suite* (`npx jest`). Jika fungsionalitas berubah 1%, maka test suite (termasuk Characterization Test dari Phase 3) pasti gagal. Kita wajib pastikan 100% PASS.

## 4. Risks, Tradeoffs, and Open Questions
- **Risk**: Perbaikan Prisma mock pada Jest bisa memakan waktu, mengingat versi Prisma dan Jest Mock Extended kadang memiliki *quirks* pada Prisma Client transaction (`tx`).
- **Mitigation**: Fokus pada perbaikan cara test ditulis tanpa mengubah kode *production* selama proses fixing test.
- **Strict Requirement check**: Pada Phase 4, pengujian E2E manual singkat di frontend disarankan (setelah Refactor) untuk memastikan integrasi UI-Backend benar-benar sama mulusnya.