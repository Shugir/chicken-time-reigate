-- supabase/migrations/20260919_loyalty_wallet_schema.sql
--
-- Loyalty Wallet & Rewards Catalog -- schema extension.
-- Extends Module 33 (promotions REWARD type + unlocked_rewards) rather than
-- standing up a parallel rewards catalog.
--
-- Order matters: loyalty_tiers must exist and be seeded before
-- profiles.current_tier_id references it and is backfilled.

-- 1. Membership tiers -------------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL,
  threshold   INTEGER      NOT NULL DEFAULT 0,
  multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  sort_order  INTEGER      NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tiers_name_key   ON loyalty_tiers(name);
CREATE INDEX        IF NOT EXISTS loyalty_tiers_threshold_idx ON loyalty_tiers(threshold);

ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public can read loyalty tiers" ON loyalty_tiers;
CREATE POLICY "public can read loyalty tiers"
  ON loyalty_tiers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "service role full access on loyalty tiers" ON loyalty_tiers;
CREATE POLICY "service role full access on loyalty tiers"
  ON loyalty_tiers USING (auth.role() = 'service_role');

INSERT INTO loyalty_tiers (name, threshold, multiplier, sort_order)
VALUES ('Standard', 0, 1.00, 0)
ON CONFLICT (name) DO NOTHING;

-- 2. Promotions: reward types, tier gating, type-specific config -------------

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS min_tier_id   UUID  NULL REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_discount_type_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_discount_type_check
  CHECK (discount_type IN ('flat','percentage','free_delivery','free_item'));

-- discount_value is NOT NULL and was CHECK (> 0). free_delivery and free_item
-- carry their benefit in reward_config, not in discount_value, so those two
-- types need to allow 0 while flat/percentage keep the > 0 guarantee.
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_discount_value_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_discount_value_check
  CHECK (
    CASE WHEN discount_type IN ('free_delivery','free_item')
      THEN discount_value >= 0
      ELSE discount_value > 0
    END
  );

-- 3. unlocked_rewards: link redemption to its order, snapshot the benefit ----

ALTER TABLE unlocked_rewards
  ADD COLUMN IF NOT EXISTS order_id      UUID  NULL REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_value JSONB NULL;

-- 4. profiles: lifetime earn total + current tier ---------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_points_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_tier_id        UUID    NULL REFERENCES loyalty_tiers(id) ON DELETE SET NULL;

-- A column DEFAULT cannot be a subquery, so inline the seeded tier's id.
DO $$
DECLARE standard_id UUID;
BEGIN
  SELECT id INTO standard_id FROM loyalty_tiers WHERE name = 'Standard' LIMIT 1;
  EXECUTE format('ALTER TABLE profiles ALTER COLUMN current_tier_id SET DEFAULT %L::uuid', standard_id);
END $$;

-- Backfill lifetime earn from the existing ledger so migration day does not
-- reset established customers to zero.
UPDATE profiles p
SET lifetime_points_earned = t.earned
FROM (
  SELECT user_id, SUM(points)::int AS earned
  FROM loyalty_transactions
  WHERE points > 0
  GROUP BY user_id
) t
WHERE t.user_id = p.id;

UPDATE profiles p
SET current_tier_id = (
  SELECT lt.id FROM loyalty_tiers lt
  WHERE lt.threshold <= p.lifetime_points_earned
  ORDER BY lt.threshold DESC
  LIMIT 1
)
WHERE p.current_tier_id IS NULL;

-- 5. Ledger: distinguish catalog redemptions from the legacy flat slider -----

ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_type_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type IN ('earn','redeem','admin_credit','admin_debit','reward_redeem'));
