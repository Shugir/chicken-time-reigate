-- Atomic loyalty redemption.
-- adjust_loyalty clamps with GREATEST(0, ...), so a debit through it can never
-- fail -- two concurrent redemptions both pass an application-side balance check
-- and the second silently clamps to 0 instead of being rejected (double-spend).
-- This function makes the balance condition part of the UPDATE itself: it
-- returns the new balance, or NULL when the balance no longer covers the cost.
-- Earn/credit stays on adjust_loyalty.

CREATE OR REPLACE FUNCTION redeem_loyalty_points(uid uuid, cost int)
RETURNS integer LANGUAGE sql AS $$
  UPDATE profiles
  SET loyalty_points = loyalty_points - cost
  WHERE id = uid AND loyalty_points >= cost
  RETURNING loyalty_points;
$$;
