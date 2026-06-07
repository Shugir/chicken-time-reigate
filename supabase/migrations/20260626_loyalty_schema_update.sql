-- Module 20 schema: balance column on profiles + per-order tracking on orders

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS points_earned   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0;
