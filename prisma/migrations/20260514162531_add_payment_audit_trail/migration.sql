-- Only add columns if table and columns don't exist (for fresh migrations)
DO $$
BEGIN
    -- First check if table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'purchase_order_payments'
    ) THEN
        -- Then add columns only if they don't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'purchase_order_payments' 
            AND column_name = 'remaining_debt_after'
        ) THEN
            ALTER TABLE "purchase_order_payments" ADD COLUMN "remaining_debt_after" DOUBLE PRECISION NOT NULL DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'purchase_order_payments' 
            AND column_name = 'remaining_debt_before'
        ) THEN
            ALTER TABLE "purchase_order_payments" ADD COLUMN "remaining_debt_before" DOUBLE PRECISION NOT NULL DEFAULT 0;
        END IF;
    END IF;
END
$$;
