-- combo_components dropped here: 0 of 57 order_items rows held a value (all NULL),
-- and nothing writes it since the deals-engine-v2 checkout cleanup.
ALTER TABLE order_items
  ADD COLUMN spicy_level TEXT,
  ADD COLUMN additions JSONB DEFAULT '[]',
  DROP COLUMN combo_components;
