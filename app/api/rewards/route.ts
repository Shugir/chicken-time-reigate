import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  deriveRewardStatus,
  deriveTierProgress,
  daysUntil,
  rewardBenefitLabel,
  rewardTitle,
  EXPIRING_SOON_DAYS,
  type Tier,
} from '@/lib/loyalty-wallet'

export const dynamic = 'force-dynamic'

const STATUS_RANK = { eligible: 0, unaffordable: 1, tier_locked: 2, redeemed: 3 } as const

// Whole-wallet read: balance, tier progress, catalog with per-user eligibility
// and the points ledger. Guests get the catalog with everything locked so the
// checkout picker can render without an account. promotions and
// loyalty_transactions are service-role-only under RLS, so every read here goes
// through supabaseAdmin rather than the browser client.
export async function GET(request: NextRequest) {
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabaseClient.auth.getUser()

  const now    = new Date()
  const nowIso = now.toISOString()

  const [tiersRes, promosRes, profileRes, unlockedRes, txnsRes] = await Promise.all([
    supabaseAdmin
      .from('loyalty_tiers')
      .select('id, name, threshold, multiplier, sort_order')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('promotions')
      .select('id, code, discount_type, discount_value, min_order_amount, points_cost, min_tier_id, reward_config, start_date, end_date')
      .eq('promo_type', 'REWARD')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${nowIso}`)
      .or(`end_date.is.null,end_date.gte.${nowIso}`)
      .order('points_cost', { ascending: true }),
    user
      ? supabaseAdmin
          .from('profiles')
          .select('loyalty_points, lifetime_points_earned, current_tier_id')
          .eq('id', user.id)
          .maybeSingle()
      : null,
    user
      ? supabaseAdmin
          .from('unlocked_rewards')
          .select('promotion_id, used_at')
          .eq('user_id', user.id)
      : null,
    user
      ? supabaseAdmin
          .from('loyalty_transactions')
          .select('id, points, type, note, created_at, order_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
      : null,
  ])

  if (tiersRes.error)  return NextResponse.json({ error: tiersRes.error.message },  { status: 500 })
  if (promosRes.error) return NextResponse.json({ error: promosRes.error.message }, { status: 500 })

  const tiers: Tier[] = (tiersRes.data ?? []).map((t) => ({
    ...t,
    multiplier: Number(t.multiplier),
  }))
  const tierById = new Map(tiers.map((t) => [t.id, t]))

  const balance  = profileRes?.data?.loyalty_points ?? 0
  const lifetime = profileRes?.data?.lifetime_points_earned ?? 0
  const progress = deriveTierProgress(lifetime, tiers, profileRes?.data?.current_tier_id ?? null)

  // Already-consumed rewards are permanently spent for this user — redeem_reward
  // rejects a second redemption (LY007) — so they must not read as available.
  const redeemedIds = new Set(
    (unlockedRes?.data ?? []).filter((u) => u.used_at).map((u) => u.promotion_id),
  )

  // A reward with no points cost can never be redeemed (redeem_reward raises
  // LY008), so it is not part of the catalog.
  const promos = (promosRes.data ?? []).filter((p) => p.points_cost != null && p.points_cost > 0)

  const freeItemIds = [...new Set(
    promos
      .filter((p) => p.discount_type === 'free_item')
      .map((p) => (p.reward_config as { menu_item_id?: string } | null)?.menu_item_id)
      .filter((id): id is string => Boolean(id)),
  )]

  const itemNames = new Map<string, string>()
  if (freeItemIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('menu_items')
      .select('id, name')
      .in('id', freeItemIds)
    for (const item of items ?? []) itemNames.set(item.id, item.name)
  }

  const rewards = promos.map((p) => {
    const minTier = p.min_tier_id ? tierById.get(p.min_tier_id) ?? null : null
    const { status, points_needed } = deriveRewardStatus({
      pointsCost:        p.points_cost!,
      balance,
      minTierSortOrder:  minTier?.sort_order ?? null,
      userTierSortOrder: progress.tier?.sort_order ?? null,
      redeemed:          redeemedIds.has(p.id),
    })

    const freeItemId   = (p.reward_config as { menu_item_id?: string } | null)?.menu_item_id
    const freeItemName = freeItemId ? itemNames.get(freeItemId) ?? null : null
    const benefit      = rewardBenefitLabel(p.discount_type, Number(p.discount_value), freeItemName)
    const days_until_expiry = daysUntil(p.end_date, now)

    return {
      id:               p.id,
      code:             p.code,
      title:            rewardTitle(p.code, benefit),
      benefit,
      discount_type:    p.discount_type,
      discount_value:   Number(p.discount_value),
      min_order_amount: Number(p.min_order_amount),
      points_cost:      p.points_cost!,
      reward_config:    p.reward_config,
      free_item_name:   freeItemName,
      min_tier:         minTier && { id: minTier.id, name: minTier.name, sort_order: minTier.sort_order },
      start_date:       p.start_date,
      end_date:         p.end_date,
      status,
      eligible:         status === 'eligible',
      points_needed,
      days_until_expiry,
      expiring_soon:    status === 'eligible'
                          && days_until_expiry !== null
                          && days_until_expiry <= EXPIRING_SOON_DAYS,
    }
  })

  rewards.sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.points_cost - b.points_cost)

  return NextResponse.json({
    authenticated:          Boolean(user),
    balance,
    lifetime_points_earned: lifetime,
    ...progress,
    rewards,
    transactions:           txnsRes?.data ?? [],
  })
}
