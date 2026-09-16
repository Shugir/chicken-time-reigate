-- supabase/migrations/20260920_redeem_reward_and_tiers.sql
--
-- Loyalty Wallet & Rewards Catalog -- catalog redemption + tier progression.
--
-- 1. redeem_reward(): validate, charge and consume a REWARD promotion in one
--    transaction, returning the benefit for checkout to apply.
-- 2. adjust_loyalty(): the earn path now also drives lifetime total and tier.

-- 1. Catalog redemption ------------------------------------------------------
--
-- Each rejection carries its own SQLSTATE in the (Postgres-unassigned) LY class
-- so the checkout API can map a failure to a specific message instead of
-- pattern-matching on text:
--
--   LY001  reward not found / not a REWARD promo
--   LY002  reward inactive
--   LY003  reward window has not opened
--   LY004  reward window has closed
--   LY005  user's tier does not unlock this reward
--   LY006  insufficient points
--   LY007  reward already redeemed by this user
--   LY008  reward is misconfigured (no usable points_cost)

CREATE OR REPLACE FUNCTION redeem_reward(
  p_uid          uuid,
  p_promotion_id uuid,
  p_order_id     uuid
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_promo        promotions%ROWTYPE;
  v_req_sort     integer;
  v_user_sort    integer;
  v_prior_used   timestamptz;
  v_prior_exists boolean;
  v_charged      integer;
  v_balance      integer;
BEGIN
  -- Lock the promo: an admin edit must not change what is being bought between
  -- the eligibility checks and the charge.
  SELECT * INTO v_promo FROM promotions WHERE id = p_promotion_id FOR UPDATE;

  IF NOT FOUND OR v_promo.promo_type <> 'REWARD' THEN
    RAISE EXCEPTION 'Reward not found' USING ERRCODE = 'LY001';
  END IF;
  IF NOT v_promo.is_active THEN
    RAISE EXCEPTION 'Reward is no longer available' USING ERRCODE = 'LY002';
  END IF;
  IF v_promo.start_date IS NOT NULL AND v_promo.start_date > now() THEN
    RAISE EXCEPTION 'Reward is not available yet' USING ERRCODE = 'LY003';
  END IF;
  IF v_promo.end_date IS NOT NULL AND v_promo.end_date < now() THEN
    RAISE EXCEPTION 'Reward has expired' USING ERRCODE = 'LY004';
  END IF;
  IF v_promo.points_cost IS NULL OR v_promo.points_cost <= 0 THEN
    RAISE EXCEPTION 'Reward has no valid points cost' USING ERRCODE = 'LY008';
  END IF;

  -- Tier ranking is sort_order (the explicit admin-controlled order), not
  -- threshold. No current tier fails any tier requirement.
  IF v_promo.min_tier_id IS NOT NULL THEN
    SELECT sort_order INTO v_req_sort
    FROM loyalty_tiers WHERE id = v_promo.min_tier_id;

    SELECT lt.sort_order INTO v_user_sort
    FROM profiles p
    JOIN loyalty_tiers lt ON lt.id = p.current_tier_id
    WHERE p.id = p_uid;

    IF v_user_sort IS NULL OR v_req_sort IS NULL OR v_user_sort < v_req_sort THEN
      RAISE EXCEPTION 'Your tier does not unlock this reward' USING ERRCODE = 'LY005';
    END IF;
  END IF;

  SELECT used_at INTO v_prior_used
  FROM unlocked_rewards
  WHERE user_id = p_uid AND promotion_id = p_promotion_id;
  v_prior_exists := FOUND;

  IF v_prior_used IS NOT NULL THEN
    RAISE EXCEPTION 'Reward already redeemed' USING ERRCODE = 'LY007';
  END IF;

  IF v_prior_exists THEN
    -- An unused row means the legacy /api/rewards/unlock flow already charged
    -- for this reward. Consume it, but do not charge a second time.
    v_charged := 0;
    SELECT loyalty_points INTO v_balance FROM profiles WHERE id = p_uid;
  ELSE
    v_charged := v_promo.points_cost;
    -- The balance condition lives inside redeem_loyalty_points' UPDATE, so two
    -- concurrent redemptions cannot both spend the same points.
    SELECT redeem_loyalty_points(p_uid, v_charged) INTO v_balance;
    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'Not enough points for this reward' USING ERRCODE = 'LY006';
    END IF;
  END IF;

  -- applied_value snapshots the benefit as it was at redemption, so later admin
  -- edits to the promo do not rewrite historical records.
  INSERT INTO unlocked_rewards (user_id, promotion_id, used_at, order_id, applied_value)
  VALUES (p_uid, p_promotion_id, now(), p_order_id, v_promo.reward_config)
  ON CONFLICT (user_id, promotion_id) DO UPDATE
  SET used_at       = now(),
      order_id      = p_order_id,
      applied_value = v_promo.reward_config;

  INSERT INTO loyalty_transactions (user_id, order_id, points, type, note)
  VALUES (p_uid, p_order_id, -v_charged, 'reward_redeem',
          COALESCE(v_promo.code, 'Reward ' || p_promotion_id::text));

  RETURN jsonb_build_object(
    'promotion_id',     v_promo.id,
    'code',             v_promo.code,
    'discount_type',    v_promo.discount_type,
    'discount_value',   v_promo.discount_value,
    'min_order_amount', v_promo.min_order_amount,
    'reward_config',    v_promo.reward_config,
    'points_spent',     v_charged,
    'new_balance',      v_balance
  );
END;
$$;

-- 2. Earn drives lifetime total and tier -------------------------------------
--
-- adjust_loyalty's only caller is the checkout earn path; admin credit/debit
-- writes profiles directly and never routes through here, so a positive delta
-- is always a genuine earn and can safely bump lifetime_points_earned.
--
-- lifetime_points_earned only ever grows (GREATEST(0, delta)), so the tier
-- subquery is monotonic too: redeeming cannot downgrade a tier. COALESCE keeps
-- the existing tier if no tier matches, rather than nulling it, since the tier
-- table is admin-editable.

CREATE OR REPLACE FUNCTION adjust_loyalty(uid uuid, delta integer)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO profiles (id, loyalty_points, lifetime_points_earned, current_tier_id)
  VALUES (
    uid,
    GREATEST(0, delta),
    GREATEST(0, delta),
    (SELECT id FROM loyalty_tiers
      WHERE threshold <= GREATEST(0, delta)
      ORDER BY threshold DESC LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE
  SET loyalty_points         = GREATEST(0, profiles.loyalty_points + delta),
      lifetime_points_earned = profiles.lifetime_points_earned + GREATEST(0, delta),
      current_tier_id        = COALESCE(
        (SELECT id FROM loyalty_tiers
          WHERE threshold <= profiles.lifetime_points_earned + GREATEST(0, delta)
          ORDER BY threshold DESC LIMIT 1),
        profiles.current_tier_id
      );
$$;

-- Pin the resolution path so none of these can be steered onto a shadowing
-- table or function planted in a caller-controlled schema. redeem_loyalty_points
-- is pinned here too: redeem_reward calls it, so leaving it unpinned would reopen
-- the same hole one call deeper.
ALTER FUNCTION redeem_reward(uuid, uuid, uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION adjust_loyalty(uuid, integer)     SET search_path = public, pg_temp;
ALTER FUNCTION redeem_loyalty_points(uuid, int)  SET search_path = public, pg_temp;
