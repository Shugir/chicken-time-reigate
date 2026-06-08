-- Module 28: Real-Time Dispatch & Multi-Stop Routing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_sequence INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_orders_driver_stop ON orders(driver_id, stop_sequence)
  WHERE delivery_status = 'out_for_delivery';
