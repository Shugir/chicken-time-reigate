-- Module 23: Dynamic Combo Meal Engine

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE combo_category_type AS ENUM ('main', 'side', 'drink');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE size_tier_type AS ENUM ('regular', 'large');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tag existing menu items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS combo_category combo_category_type DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS size_tier      size_tier_type      DEFAULT NULL;

-- 3. Per-size combo discount configuration
CREATE TABLE IF NOT EXISTS combo_discounts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_size       TEXT    NOT NULL UNIQUE CHECK (meal_size IN ('medium', 'large')),
  name            TEXT    NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed default discount rows (idempotent)
INSERT INTO combo_discounts (meal_size, name, discount_amount, is_active)
  VALUES
    ('medium', 'Medium Meal Deal', 1.50, true),
    ('large',  'Large Meal Deal',  2.00, true)
  ON CONFLICT (meal_size) DO NOTHING;

-- 4. Store combo component breakdown on order items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS combo_components JSONB DEFAULT NULL;
-- Shape: [{ id: uuid, name: text, category: "main"|"side"|"drink", size_tier: "regular"|"large" }]
