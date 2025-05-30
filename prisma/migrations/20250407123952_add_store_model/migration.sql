/*
  Warnings:

  - Added the required column `store_id` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store_id` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/

-- Buat UUID untuk store default
-- Gunakan function randamUUID() SQLite untuk membuat UUID
-- Dan simpan nilainya dalam variabel @default_store_id
PRAGMA foreign_keys=OFF;

-- Generate UUID untuk toko default
CREATE TABLE IF NOT EXISTS "_prisma_migrations_temp" (
    "uuid" TEXT PRIMARY KEY
);
INSERT INTO "_prisma_migrations_temp" ("uuid") VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))));

-- Ambil UUID yang dibuat dan simpan dalam variabel
CREATE TABLE IF NOT EXISTS "_prisma_migrations_vars" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL
);
INSERT INTO "_prisma_migrations_vars" ("key", "value")
SELECT 'default_store_id', "uuid" FROM "_prisma_migrations_temp" LIMIT 1;

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- Buat toko default
INSERT INTO "stores" ("id", "name", "description", "is_active", "created_at", "updated_at")
SELECT "value", 'Toko Default', 'Toko default yang dibuat oleh migrasi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "stock" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier_id" TEXT,
    "store_id" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "threshold" REAL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "purchase_price" REAL,
    "expiry_date" DATETIME,
    "batch_number" TEXT,
    "purchase_date" DATETIME,
    "min_selling_price" REAL,
    CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("barcode", "batch_number", "category", "created_at", "description", "expiry_date", "id", "is_deleted", "min_selling_price", "name", "price", "purchase_date", "purchase_price", "stock", "supplier_id", "threshold", "unit", "updated_at", "store_id") 
SELECT "barcode", "batch_number", "category", "created_at", "description", "expiry_date", "id", "is_deleted", "min_selling_price", "name", "price", "purchase_date", "purchase_price", "stock", "supplier_id", "threshold", "unit", "updated_at", 
(SELECT "value" FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id')
FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_barcode_store_id_key" ON "products"("barcode", "store_id");

CREATE TABLE "new_purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "po_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "estimated_delivery" DATETIME,
    "notes" TEXT,
    CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_purchase_orders" ("created_at", "estimated_delivery", "id", "notes", "po_number", "status", "supplier_id", "updated_at", "store_id") 
SELECT "created_at", "estimated_delivery", "id", "notes", "po_number", "status", "supplier_id", "updated_at",
(SELECT "value" FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id')
FROM "purchase_orders";
DROP TABLE "purchase_orders";
ALTER TABLE "new_purchase_orders" RENAME TO "purchase_orders";
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

CREATE TABLE "new_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "store_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "suppliers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_suppliers" ("address", "created_at", "email", "id", "name", "phone", "updated_at", "store_id") 
SELECT "address", "created_at", "email", "id", "name", "phone", "updated_at",
(SELECT "value" FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id')
FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";

CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "total" REAL NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_details" TEXT,
    "store_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("created_at", "id", "payment_details", "payment_method", "total", "updated_at", "store_id") 
SELECT "created_at", "id", "payment_details", "payment_method", "total", "updated_at",
(SELECT "value" FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id')
FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";

CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "store_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "id", "name", "password", "role", "updated_at", "store_id") 
SELECT "created_at", "email", "id", "name", "password", "role", "updated_at",
(SELECT "value" FROM "_prisma_migrations_vars" WHERE "key" = 'default_store_id')
FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Hapus tabel temporary
DROP TABLE "_prisma_migrations_temp";
DROP TABLE "_prisma_migrations_vars";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
