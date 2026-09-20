import { describe, it, expect } from 'vitest'
import {
  REWARD_ERRORS,
  isRewardRejection,
  selectableRewards,
  rewardDiscountAmount,
  promoWindowError,
} from './reward-checkout'

describe('promoWindowError', () => {
  const now = new Date('2026-09-19T12:00:00Z')

  it('is null with no window or inside it', () => {
    expect(promoWindowError({ start_date: null, end_date: null }, now)).toBeNull()
    expect(promoWindowError({ start_date: '2026-09-01T00:00:00Z', end_date: '2026-10-01T00:00:00Z' }, now)).toBeNull()
  })

  it('rejects a code that has not started or has expired', () => {
    expect(promoWindowError({ start_date: '2026-09-20T00:00:00Z', end_date: null }, now)).toMatch(/not active yet/)
    expect(promoWindowError({ start_date: null, end_date: '2026-09-18T00:00:00Z' }, now)).toMatch(/expired/)
  })
})

function reward(over: Partial<{ eligible: boolean; min_order_amount: number; id: string }> = {}) {
  return { id: 'r1', eligible: true, min_order_amount: 0, ...over }
}

describe('selectableRewards', () => {
  it('keeps eligible rewards the cart meets the minimum for', () => {
    const r = reward({ min_order_amount: 15 })
    expect(selectableRewards([r], 20)).toEqual([r])
    expect(selectableRewards([r], 15)).toEqual([r])
  })

  it('drops eligible rewards whose min_order_amount exceeds the subtotal', () => {
    expect(selectableRewards([reward({ min_order_amount: 25 })], 24.99)).toEqual([])
  })

  it('drops ineligible rewards regardless of subtotal', () => {
    expect(selectableRewards([reward({ eligible: false })], 100)).toEqual([])
  })
})

describe('rewardDiscountAmount', () => {
  it('is zero with no reward', () => {
    expect(rewardDiscountAmount(null, 30)).toBe(0)
  })

  it('prices a percentage reward against the subtotal, rounded to pence', () => {
    expect(rewardDiscountAmount({ discount_type: 'percentage', discount_value: 10 }, 33.33)).toBe(3.33)
  })

  it('caps a flat reward at the subtotal', () => {
    expect(rewardDiscountAmount({ discount_type: 'flat', discount_value: 5 }, 30)).toBe(5)
    expect(rewardDiscountAmount({ discount_type: 'flat', discount_value: 50 }, 30)).toBe(30)
  })

  it('gives no line discount for free_delivery or free_item', () => {
    expect(rewardDiscountAmount({ discount_type: 'free_delivery', discount_value: 0 }, 30)).toBe(0)
    expect(rewardDiscountAmount({ discount_type: 'free_item', discount_value: 0 }, 30)).toBe(0)
  })
})

describe('isRewardRejection', () => {
  it('matches every redeem_reward RPC message', () => {
    for (const message of Object.values(REWARD_ERRORS)) {
      expect(isRewardRejection(message)).toBe(true)
    }
  })

  it('matches the reward rejections raised outside the RPC, including interpolated ones', () => {
    expect(isRewardRejection('This reward needs a minimum order of £20.00')).toBe(true)
    expect(isRewardRejection('A bundle deal already applies to this cart — remove the reward or change your items')).toBe(true)
    expect(isRewardRejection('A reward and a promo code cannot be used on the same order')).toBe(true)
    expect(isRewardRejection('Sign in to redeem a reward')).toBe(true)
  })

  it('leaves the selection alone for failures that are not about the reward', () => {
    expect(isRewardRejection('Sorry, Wings just sold out. Please remove it from your cart to continue.')).toBe(false)
    expect(isRewardRejection('Store is not accepting orders')).toBe(false)
    expect(isRewardRejection('Failed to create order')).toBe(false)
  })
})
