import { describe, it, expect } from 'vitest'
import { deriveTierProgress, deriveRewardStatus, daysUntil, rewardTitle, rewardBenefitLabel, type Tier } from './loyalty-wallet'

const TIERS: Tier[] = [
  { id: 'std',  name: 'Standard', threshold: 0,    multiplier: 1,   sort_order: 0 },
  { id: 'silv', name: 'Silver',   threshold: 1000, multiplier: 1.2, sort_order: 1 },
  { id: 'gold', name: 'Gold',     threshold: 5000, multiplier: 1.5, sort_order: 2 },
]

describe('deriveTierProgress', () => {
  it('measures progress between the current and next tier thresholds', () => {
    const p = deriveTierProgress(3000, TIERS, 'silv')
    expect(p.tier?.name).toBe('Silver')
    expect(p.next_tier?.name).toBe('Gold')
    expect(p.points_to_next_tier).toBe(2000)
    expect(p.tier_progress_pct).toBe(50)
  })

  it('reports a full bar and no next tier at the top tier', () => {
    const p = deriveTierProgress(9999, TIERS, 'gold')
    expect(p.next_tier).toBeNull()
    expect(p.points_to_next_tier).toBeNull()
    expect(p.tier_progress_pct).toBe(100)
  })

  it('starts an empty wallet at the bottom tier with zero progress', () => {
    const p = deriveTierProgress(0, TIERS, 'std')
    expect(p.tier?.name).toBe('Standard')
    expect(p.points_to_next_tier).toBe(1000)
    expect(p.tier_progress_pct).toBe(0)
  })

  it('ranks a profile with no tier below every tier', () => {
    const p = deriveTierProgress(0, TIERS, null)
    expect(p.tier).toBeNull()
    expect(p.next_tier?.name).toBe('Standard')
  })

  it('does not divide by zero when two tiers share a threshold', () => {
    const flat: Tier[] = [
      { id: 'a', name: 'A', threshold: 500, multiplier: 1, sort_order: 0 },
      { id: 'b', name: 'B', threshold: 500, multiplier: 2, sort_order: 1 },
    ]
    expect(deriveTierProgress(500, flat, 'a').tier_progress_pct).toBe(100)
  })

  it('has no next tier when only one tier exists', () => {
    expect(deriveTierProgress(10, [TIERS[0]], 'std').next_tier).toBeNull()
  })
})

describe('deriveRewardStatus', () => {
  const base = { pointsCost: 500, balance: 500, minTierSortOrder: null, userTierSortOrder: 0, redeemed: false }

  it('is eligible when affordable and untiered', () => {
    expect(deriveRewardStatus(base)).toEqual({ status: 'eligible', points_needed: 0 })
  })

  it('reports the shortfall for a zero-balance wallet', () => {
    expect(deriveRewardStatus({ ...base, balance: 0 }))
      .toEqual({ status: 'unaffordable', points_needed: 500 })
  })

  it('locks a reward above the user tier even when affordable', () => {
    expect(deriveRewardStatus({ ...base, minTierSortOrder: 2, userTierSortOrder: 1 }))
      .toEqual({ status: 'tier_locked', points_needed: 0 })
  })

  it('unlocks a reward at exactly the required tier', () => {
    expect(deriveRewardStatus({ ...base, minTierSortOrder: 2, userTierSortOrder: 2 }).status)
      .toBe('eligible')
  })

  it('locks a tier-gated reward for a profile with no tier', () => {
    expect(deriveRewardStatus({ ...base, minTierSortOrder: 0, userTierSortOrder: null }).status)
      .toBe('tier_locked')
  })

  it('reports tier lock ahead of affordability', () => {
    expect(deriveRewardStatus({ ...base, balance: 0, minTierSortOrder: 1, userTierSortOrder: 0 }))
      .toEqual({ status: 'tier_locked', points_needed: 500 })
  })

  it('marks an already-redeemed reward regardless of balance and tier', () => {
    expect(deriveRewardStatus({ ...base, redeemed: true }).status).toBe('redeemed')
  })
})

describe('daysUntil', () => {
  const now = new Date('2026-09-16T12:00:00Z')

  it('returns null without an end date', () => {
    expect(daysUntil(null, now)).toBeNull()
  })

  it('counts whole days remaining', () => {
    expect(daysUntil('2026-09-21T12:00:00Z', now)).toBe(5)
  })

  it('returns 0 on the final day', () => {
    expect(daysUntil('2026-09-16T23:00:00Z', now)).toBe(0)
  })

  it('goes negative once past', () => {
    expect(daysUntil('2026-09-15T12:00:00Z', now)).toBe(-1)
  })
})

describe('reward labelling', () => {
  it('describes each discount type', () => {
    expect(rewardBenefitLabel('percentage', 10, null)).toBe('10% off')
    expect(rewardBenefitLabel('flat', 5, null)).toBe('£5.00 off')
    expect(rewardBenefitLabel('free_delivery', 0, null)).toBe('Free delivery')
    expect(rewardBenefitLabel('free_item', 0, 'Wings')).toBe('Free Wings')
  })

  it('falls back to a generic label when the free item is unresolved', () => {
    expect(rewardBenefitLabel('free_item', 0, null)).toBe('Free item')
  })

  it('falls back to the benefit when the promotion has no code', () => {
    expect(rewardTitle(null, 'Free delivery')).toBe('Free delivery')
    expect(rewardTitle('FREE_DELIVERY', 'Free delivery')).toBe('Free Delivery')
  })
})
