-- Module 20: Customer Loyalty Points
-- 10 points per £1 spent, 100 points = £1 redeemable

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id   UUID        REFERENCES orders(id) ON DELETE SET NULL,
  points     INT         NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('earn', 'redeem', 'admin_credit', 'admin_debit')),
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_transactions_user_idx ON loyalty_transactions (user_id, created_at DESC);
