-- Module 20 schema: balance column on profiles + per-order tracking on orders

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS points_earned   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION adjust_loyalty(uid uuid, delta int)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO profiles (id, loyalty_points) VALUES (uid, GREATEST(0, delta))
  ON CONFLICT (id) DO UPDATE
  SET loyalty_points = GREATEST(0, profiles.loyalty_points + delta);
$$;
