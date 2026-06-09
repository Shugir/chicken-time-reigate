-- Module 33: Loyalty Rewards Engine
-- Adds promo_type, points_cost to promotions; unlocked_rewards tracking table

ALTER TABLE promotions
  ALTER COLUMN code DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS promo_type  TEXT    NOT NULL DEFAULT 'VOUCHER'
    CHECK (promo_type IN ('VOUCHER','REWARD','AUTO_APPLY')),
  ADD COLUMN IF NOT EXISTS points_cost INTEGER NULL;

CREATE TABLE IF NOT EXISTS unlocked_rewards (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_id   UUID        NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at        TIMESTAMPTZ NULL,
  UNIQUE(user_id, promotion_id)
);
CREATE INDEX IF NOT EXISTS unlocked_rewards_user_idx ON unlocked_rewards(user_id);
ALTER TABLE unlocked_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own unlocked rewards"
  ON unlocked_rewards FOR ALL TO authenticated
  USING (user_id = auth.uid());
