-- supabase/migrations/20260917b_deals_v2_backfill_and_drop.sql

-- Migrate live bundle deals from {label, category, pick_qty} groups to
-- {label, min_qty, max_qty, item_ids}. item_ids resolved from current
-- menu_items.category membership at migration time -- a snapshot; future
-- menu changes no longer auto-affect these deals, which is the point
-- (assignment is now explicit, done in the admin slot builder).
DO $$
DECLARE
  deal RECORD;
  new_groups JSONB;
  grp JSONB;
  ids JSONB;
BEGIN
  FOR deal IN SELECT id, config FROM deals WHERE type = 'bundle' LOOP
    new_groups := '[]'::jsonb;
    FOR grp IN SELECT * FROM jsonb_array_elements(deal.config->'groups') LOOP
      SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO ids
        FROM menu_items WHERE category = (grp->>'category');
      new_groups := new_groups || jsonb_build_array(jsonb_build_object(
        'label', grp->>'label',
        'min_qty', (grp->>'pick_qty')::int,
        'max_qty', (grp->>'pick_qty')::int,
        'item_ids', ids
      ));
    END LOOP;
    UPDATE deals SET config = jsonb_set(config, '{groups}', new_groups) WHERE id = deal.id;
  END LOOP;
END $$;

ALTER TABLE menu_items DROP COLUMN combo_category;
ALTER TABLE menu_items DROP COLUMN size_tier;
