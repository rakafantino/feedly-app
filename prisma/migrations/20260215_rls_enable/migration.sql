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
-- Note: Using PUBLIC role since Neon doesn't have "authenticated" role
-- The RLS policies use session variables set by the application
-- Cast text to UUID using NULLIF to handle empty settings
-- ============================================

-- Helper: Safe function to get session variable
-- Returns NULL if setting is empty or not set
CREATE OR REPLACE FUNCTION app_current_store_id()
RETURNS text AS $$
SELECT NULLIF(current_setting('app.current_store_id', true), '');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text AS $$
SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION app_current_store_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO PUBLIC;

-- Stores table: Users can only see stores they have access to via StoreAccess
CREATE POLICY "Users can only see stores they have access to"
ON stores FOR SELECT
TO PUBLIC
USING (
  EXISTS (
    SELECT 1 FROM store_access
    WHERE store_access.store_id = stores.id
    AND store_access.user_id = app_current_user_id()
  )
);

-- Transactions table: Filter by store_id from session
CREATE POLICY "Users can only access their store's transactions"
ON transactions FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Customers table: Filter by store_id from session
CREATE POLICY "Users can only access their store's customers"
ON customers FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Products table: Filter by store_id from session
CREATE POLICY "Users can only access their store's products"
ON products FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Purchase Orders table: Filter by store_id from session
CREATE POLICY "Users can only access their store's purchase orders"
ON purchase_orders FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Expenses table: Filter by store_id from session
CREATE POLICY "Users can only access their store's expenses"
ON expenses FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Stock Adjustments table: Filter by store_id from session
CREATE POLICY "Users can only access their store's stock adjustments"
ON stock_adjustments FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Notifications table: Filter by store_id from session
CREATE POLICY "Users can only access their store's notifications"
ON notifications FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- Suppliers table: Filter by store_id from session
CREATE POLICY "Users can only access their store's suppliers"
ON suppliers FOR ALL
TO PUBLIC
USING (store_id = app_current_store_id())
WITH CHECK (store_id = app_current_store_id());

-- ============================================
-- STEP 3: Create helper function for setting session context
-- ============================================

CREATE OR REPLACE FUNCTION set_tenant_context(store_id text, user_id text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_store_id', store_id, false);
  PERFORM set_config('app.current_user_id', user_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION set_tenant_context(text, text) TO PUBLIC;
