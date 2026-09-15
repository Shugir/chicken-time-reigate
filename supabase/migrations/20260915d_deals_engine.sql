-- supabase/migrations/20260915d_deals_engine.sql

CREATE TYPE deal_type AS ENUM ('bogo', 'bundle', 'fixed_meal', 'order_discount');

CREATE TABLE deals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        deal_type NOT NULL,
  name        TEXT NOT NULL,
  config      JSONB NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read active deals"
  ON deals FOR SELECT USING (true);

CREATE POLICY "service role full access on deals"
  ON deals USING (auth.role() = 'service_role');

ALTER TABLE orders ADD COLUMN applied_deals JSONB DEFAULT NULL;

-- Legacy migration: fold the live medium/large combo_discounts rows into
-- two seed `bundle` deals so nothing is lost when /menu/combo is removed
-- (Task 12). This uses category slugs directly — if items tagged
-- combo_category='main' span more than one category slug in your live
-- data, edit the `category` values below (or switch that group to
-- item_ids) before running this migration; check with:
--   SELECT DISTINCT category FROM menu_items WHERE combo_category = 'main';
DO $$
DECLARE
  medium_discount NUMERIC;
  large_discount  NUMERIC;
BEGIN
  SELECT discount_amount INTO medium_discount FROM combo_discounts WHERE meal_size = 'medium' LIMIT 1;
  SELECT discount_amount INTO large_discount  FROM combo_discounts WHERE meal_size = 'large'  LIMIT 1;

  IF medium_discount IS NOT NULL THEN
    INSERT INTO deals (type, name, config, is_active) VALUES (
      'bundle',
      'Medium Meal Deal',
      jsonb_build_object(
        'groups', jsonb_build_array(
          jsonb_build_object('label', 'Main',  'category', 'chicken', 'pick_qty', 1),
          jsonb_build_object('label', 'Side',  'category', 'sides',   'pick_qty', 1),
          jsonb_build_object('label', 'Drink', 'category', 'drinks',  'pick_qty', 1)
        ),
        'price', GREATEST(0, (
          SELECT AVG(price) FROM menu_items WHERE combo_category = 'main'
        ) - medium_discount)
      ),
      true
    );
  END IF;

  IF large_discount IS NOT NULL THEN
    INSERT INTO deals (type, name, config, is_active) VALUES (
      'bundle',
      'Large Meal Deal',
      jsonb_build_object(
        'groups', jsonb_build_array(
          jsonb_build_object('label', 'Main',  'category', 'chicken', 'pick_qty', 1),
          jsonb_build_object('label', 'Side',  'category', 'sides',   'pick_qty', 1),
          jsonb_build_object('label', 'Drink', 'category', 'drinks',  'pick_qty', 1)
        ),
        'price', GREATEST(0, (
          SELECT AVG(price) FROM menu_items WHERE combo_category = 'main'
        ) - large_discount)
      ),
      true
    );
  END IF;
END $$;
