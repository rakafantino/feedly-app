-- Enable Row Level Security on all multi-tenant tables
-- Migration: 20260215_rls_enable
-- Purpose: Implement database-level RLS for multi-tenant isolation

-- ============================================
-- STEP 1: Enable RLS on all critical tables
-- ============================================

-- Enable RLS on stores table (for user access validation)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;

-- Enable RLS on transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

-- Enable RLS on purchase_orders table
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

-- Enable RLS on expenses table
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;

-- Enable RLS on stock_adjustments table
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments FORCE ROW LEVEL SECURITY;

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- Enable RLS on suppliers table
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Create RLS Policies
-- ============================================

-- Stores table: Users can only see stores they have access to via StoreAccess
CREATE POLICY "Users can only see stores they have access to"
ON stores FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM store_access
    WHERE store_access.store_id = stores.id
    AND store_access.user_id = current_setting('app.current_user_id', true)::uuid
  )
);

-- Transactions table: Filter by store_id from session
CREATE POLICY "Users can only access their store's transactions"
ON transactions FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Customers table: Filter by store_id from session
CREATE POLICY "Users can only access their store's customers"
ON customers FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Products table: Filter by store_id from session
CREATE POLICY "Users can only access their store's products"
ON products FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Purchase Orders table: Filter by store_id from session
CREATE POLICY "Users can only access their store's purchase orders"
ON purchase_orders FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Expenses table: Filter by store_id from session
CREATE POLICY "Users can only access their store's expenses"
ON expenses FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Stock Adjustments table: Filter by store_id from session
CREATE POLICY "Users can only access their store's stock adjustments"
ON stock_adjustments FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Notifications table: Filter by store_id from session
CREATE POLICY "Users can only access their store's notifications"
ON notifications FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- Suppliers table: Filter by store_id from session
CREATE POLICY "Users can only access their store's suppliers"
ON suppliers FOR ALL
TO authenticated
USING (store_id = current_setting('app.current_store_id', true)::uuid)
WITH CHECK (store_id = current_setting('app.current_store_id', true)::uuid);

-- ============================================
-- STEP 3: Create helper function for setting session context
-- ============================================

CREATE OR REPLACE FUNCTION set_tenant_context(store_id uuid, user_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_store_id', store_id::text, false);
  PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Grant execute on helper function to authenticated users
-- ============================================

GRANT EXECUTE ON FUNCTION set_tenant_context(uuid, uuid) TO authenticated;

-- ============================================
-- Verification Query (run to confirm RLS is enabled)
-- ============================================
-- SELECT 
--   schemaname,
--   tablename,
--   rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('stores', 'transactions', 'customers', 'products', 
--                   'purchase_orders', 'expenses', 'stock_adjustments', 
--                   'notifications', 'suppliers');
