-- D: admin-controlled "VAT included" line on the customizer receipt (display only).
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS show_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 20
    CHECK (vat_rate >= 0 AND vat_rate <= 100);

-- E: a signed-in customer's saved builds of a menu item.
-- selection holds names only ({spicy, removals, additions, extras:[{name, category, qty}]});
-- prices are always re-read from menu_items when a preset is applied.
CREATE TABLE IF NOT EXISTS item_presets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  selection    jsonb NOT NULL,
  notes        text CHECK (notes IS NULL OR char_length(notes) <= 250),
  qty          integer NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 99),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_item_id, name)
);

CREATE INDEX IF NOT EXISTS item_presets_user_item_idx ON item_presets (user_id, menu_item_id);

ALTER TABLE item_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_presets_select_own ON item_presets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY item_presets_insert_own ON item_presets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY item_presets_update_own ON item_presets FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY item_presets_delete_own ON item_presets FOR DELETE TO authenticated USING (user_id = auth.uid());
