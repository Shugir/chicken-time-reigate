ALTER TABLE menu_items
  ADD COLUMN spicy_levels text[] DEFAULT '{}',
  ADD COLUMN ingredients text[] DEFAULT '{}',
  ADD COLUMN add_ons JSONB DEFAULT '[]',
  ADD COLUMN drinks_regular JSONB DEFAULT '[]',
  ADD COLUMN drinks_large JSONB DEFAULT '[]',
  ADD COLUMN dips JSONB DEFAULT '[]',
  ADD COLUMN sides JSONB DEFAULT '[]',
  ADD COLUMN fries_regular JSONB DEFAULT '[]',
  ADD COLUMN fries_large JSONB DEFAULT '[]',
  ADD COLUMN other_extras JSONB DEFAULT '[]',
  ADD COLUMN modifier_select_modes JSONB DEFAULT '{"spicy_levels":"single","dips":"single","fries_regular":"single","fries_large":"single","add_ons":"multi","drinks_regular":"multi","drinks_large":"multi","sides":"multi","other_extras":"multi"}';

-- removals is jsonb (array of strings) here, not text[]: unnest it rather than assign it directly.
UPDATE menu_items
SET ingredients = ARRAY(SELECT jsonb_array_elements_text(removals))
WHERE removals IS NOT NULL;

UPDATE menu_items SET add_ons = extras WHERE extras IS NOT NULL;
