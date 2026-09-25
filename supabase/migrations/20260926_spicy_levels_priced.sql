-- Spicy levels become priced options ({name, price}, same shape as the other modifier
-- categories). Existing levels carry over free, in their original order.
-- order_items.spicy_level (the chosen level, plain text) is unchanged.
--
-- ALTER COLUMN ... TYPE ... USING cannot contain a subquery, so the conversion goes
-- through a session-temporary function. The old text[] default ('{}') has no cast to
-- jsonb, so it is dropped before the type change and replaced after.

CREATE FUNCTION pg_temp.spicy_levels_to_jsonb(levels text[]) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', t.v, 'price', 0) ORDER BY t.ord), '[]'::jsonb)
  FROM unnest(levels) WITH ORDINALITY AS t(v, ord)
$$;

ALTER TABLE menu_items
  ALTER COLUMN spicy_levels DROP DEFAULT,
  ALTER COLUMN spicy_levels TYPE jsonb USING pg_temp.spicy_levels_to_jsonb(spicy_levels),
  ALTER COLUMN spicy_levels SET DEFAULT '[]'::jsonb;
