-- supabase/migrations/20260915e_round_deal_prices.sql
-- Corrects bundle deal prices that were seeded with full float precision.
-- Rounds existing config->>'price' values to 2 decimal places for any bundle deals.

UPDATE deals
SET config = jsonb_set(config, '{price}', to_jsonb(ROUND((config->>'price')::numeric, 2)))
WHERE type = 'bundle';
