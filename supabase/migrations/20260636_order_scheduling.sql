-- Module 37: Order Scheduling Engine
-- Allows customers to schedule orders for a future time (null = ASAP)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON orders(scheduled_for)
  WHERE scheduled_for IS NOT NULL;
