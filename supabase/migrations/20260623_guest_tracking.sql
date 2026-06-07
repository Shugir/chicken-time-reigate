-- Module 13: Guest Order Tracking
-- Adds customer_email to orders so guests can verify identity on /track

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Index for fast lookup by email + id (the tracking query pattern)
CREATE INDEX IF NOT EXISTS orders_tracking_idx ON orders (id, customer_email);
