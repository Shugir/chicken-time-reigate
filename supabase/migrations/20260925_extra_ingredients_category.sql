ALTER TABLE menu_items
  ADD COLUMN extra_ingredients JSONB DEFAULT '[]',
  ALTER COLUMN modifier_select_modes SET DEFAULT '{"spicy_levels":"single","dips":"single","fries_regular":"single","fries_large":"single","add_ons":"multi","drinks_regular":"multi","drinks_large":"multi","sides":"multi","other_extras":"multi","extra_ingredients":"multi"}';
