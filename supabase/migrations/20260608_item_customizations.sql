ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS extras   JSONB DEFAULT '[]'::jsonb;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS removals JSONB DEFAULT '[]'::jsonb;
