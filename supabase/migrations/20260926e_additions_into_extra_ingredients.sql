-- Admin now manages all extra ingredients in one priced list (free ones at £0.00).
-- Move each item's free "additions" into extra_ingredients as £0.00 options, skipping
-- names already there, and clear additions. Items that had no priced extra ingredients
-- get the 'pick' mode (tick several, one each), which is how free additions behaved.
UPDATE menu_items m
SET
  extra_ingredients = COALESCE(m.extra_ingredients, '[]'::jsonb) || COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', a.name, 'price', 0) ORDER BY a.ord)
    FROM unnest(m.additions) WITH ORDINALITY AS a(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(m.extra_ingredients, '[]'::jsonb)) e
      WHERE e->>'name' = a.name)
  ), '[]'::jsonb),
  modifier_select_modes = CASE
    WHEN jsonb_array_length(COALESCE(m.extra_ingredients, '[]'::jsonb)) = 0
      THEN COALESCE(m.modifier_select_modes, '{}'::jsonb) || '{"extra_ingredients":"pick"}'::jsonb
    ELSE m.modifier_select_modes
  END,
  additions = '{}'
WHERE cardinality(m.additions) > 0;
