ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'delivery'
  CHECK (order_type IN ('delivery', 'pickup'));
