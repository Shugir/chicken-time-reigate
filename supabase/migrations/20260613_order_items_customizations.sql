ALTER TABLE order_items ADD COLUMN IF NOT EXISTS extras   JSONB DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS removals JSONB DEFAULT '[]'::jsonb;
