// Pure wallet derivations shared by GET /api/rewards and its tests. Tier
// ranking is sort_order, matching the redeem_reward RPC — threshold only drives
// progress display.

export type RewardDiscountType = 'flat' | 'percentage' | 'free_delivery' | 'free_item'

export type RewardStatus = 'eligible' | 'redeemed' | 'tier_locked' | 'unaffordable'

export interface Tier {
  id:         string
  name:       string
  threshold:  number
  multiplier: number
  sort_order: number
}

export interface TierProgress {
  tier:                Tier | null
  next_tier:           Tier | null
  points_to_next_tier: number | null
  tier_progress_pct:   number
}

const DAY_MS = 86_400_000

export const EXPIRING_SOON_DAYS = 7

/**
 * `tiers` must be sorted by sort_order ascending. A null currentTierId (legacy
 * profile rows predating the tier column) ranks below every tier rather than
 * inheriting one, so it never unlocks a tier-gated reward.
 */
export function deriveTierProgress(
  lifetimePoints: number,
  tiers:          Tier[],
  currentTierId:  string | null,
): TierProgress {
  const tier  = tiers.find((t) => t.id === currentTierId) ?? null
  const index = tier ? tiers.indexOf(tier) : -1

  const next_tier = tiers[index + 1] ?? null
  if (!next_tier) {
    return { tier, next_tier: null, points_to_next_tier: null, tier_progress_pct: 100 }
  }

  const floor = tier?.threshold ?? 0
  const span  = next_tier.threshold - floor

  return {
    tier,
    next_tier,
    points_to_next_tier: Math.max(0, next_tier.threshold - lifetimePoints),
    // A non-positive span means an admin set the next tier's threshold at or
    // below this one's; there is no distance left to show.
    tier_progress_pct: span <= 0
      ? 100
      : clampPct(((lifetimePoints - floor) / span) * 100),
  }
}

export function deriveRewardStatus(input: {
  pointsCost:        number
  balance:           number
  minTierSortOrder:  number | null
  userTierSortOrder: number | null
  redeemed:          boolean
}): { status: RewardStatus; points_needed: number } {
  const points_needed = Math.max(0, input.pointsCost - input.balance)

  if (input.redeemed) return { status: 'redeemed', points_needed }

  const tierOk = input.minTierSortOrder === null
    || (input.userTierSortOrder !== null && input.userTierSortOrder >= input.minTierSortOrder)

  if (!tierOk)         return { status: 'tier_locked',  points_needed }
  if (points_needed)   return { status: 'unaffordable', points_needed }
  return { status: 'eligible', points_needed: 0 }
}

/** Whole days left before `endDate`; 0 means it expires today, null means no end date. */
export function daysUntil(endDate: string | null, now: Date): number | null {
  if (!endDate) return null
  return Math.floor((new Date(endDate).getTime() - now.getTime()) / DAY_MS)
}

export function rewardBenefitLabel(
  discountType:  string,
  discountValue: number,
  freeItemName:  string | null,
): string {
  switch (discountType) {
    case 'percentage':     return `${Number(discountValue)}% off`
    case 'flat':           return `£${Number(discountValue).toFixed(2)} off`
    case 'free_delivery':  return 'Free delivery'
    case 'free_item':      return freeItemName ? `Free ${freeItemName}` : 'Free item'
    default:               return 'Reward'
  }
}

/** Promotions have no name column; `code` is the display name and is nullable. */
export function rewardTitle(code: string | null, benefit: string): string {
  if (!code) return benefit
  return code.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, Math.round(pct)))
}
