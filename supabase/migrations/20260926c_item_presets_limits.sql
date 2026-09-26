-- Server-side limits for item_presets: the client caps these too, but RLS alone
-- lets a signed-in user insert unbounded rows / oversized selections directly.

ALTER TABLE item_presets
  ADD CONSTRAINT item_presets_selection_size CHECK (pg_column_size(selection) <= 4096);

-- Max 10 presets per (user, item). A save that reuses an existing name is an
-- upsert that replaces that row, so it is allowed even at the limit.
CREATE OR REPLACE FUNCTION item_presets_enforce_limit() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM item_presets
       WHERE user_id = NEW.user_id AND menu_item_id = NEW.menu_item_id AND name = NEW.name)
     AND (SELECT count(*) FROM item_presets
          WHERE user_id = NEW.user_id AND menu_item_id = NEW.menu_item_id) >= 10 THEN
    RAISE EXCEPTION 'preset limit reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER item_presets_limit BEFORE INSERT ON item_presets
  FOR EACH ROW EXECUTE FUNCTION item_presets_enforce_limit();
