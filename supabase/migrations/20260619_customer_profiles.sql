-- Add customer contact columns to orders
-- delivery_address already exists from initial schema (20260603_initial_schema.sql)
-- profiles table already exists from initial schema (20260603_initial_schema.sql)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;
