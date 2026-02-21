-- Optimize RLS functions by marking them as STABLE
-- This prevents Postgres from evaluating the function for every single row

CREATE OR REPLACE FUNCTION app_current_store_id()
RETURNS text AS $$
SELECT NULLIF(current_setting('app.current_store_id', true), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS text AS $$
SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;