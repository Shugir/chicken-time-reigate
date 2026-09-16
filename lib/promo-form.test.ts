import { describe, it, expect } from 'vitest'
import { buildPromoPayload, validatePromoPayload, type PromoFormInput } from './promo-form'

const BASE: PromoFormInput = {
  promoType:    'VOUCHER',
  code:         'save5',
  discountType: 'flat',
  value:        '5',
  minOrder:     '0',
  pointsCost:   '',
  minTierId:    '',
  menuItemId:   '',
  startDate:    '',
  endDate:      '',
}

const form = (over: Partial<PromoFormInput> = {}) => ({ ...BASE, ...over })
const check = (over: Partial<PromoFormInput> = {}) => validatePromoPayload(buildPromoPayload(form(over)))

describe('buildPromoPayload', () => {
  it('uppercases the code and keeps flat values', () => {
    expect(buildPromoPayload(form())).toMatchObject({
      code: 'SAVE5', discount_type: 'flat', discount_value: 5, reward_config: {}, min_tier_id: null,
    })
  })

  it('zeroes discount_value for free_delivery', () => {
    expect(buildPromoPayload(form({ discountType: 'free_delivery', value: '5' })).discount_value).toBe(0)
  })

  it('writes menu_item_id into reward_config for free_item', () => {
    const p = buildPromoPayload(form({ discountType: 'free_item', menuItemId: 'item-123' }))
    expect(p.discount_value).toBe(0)
    expect(p.reward_config).toEqual({ menu_item_id: 'item-123' })
  })

  it('only carries min_tier_id and points_cost for REWARD promos', () => {
    expect(buildPromoPayload(form({ minTierId: 'tier-1', pointsCost: '500' }))).toMatchObject({
      min_tier_id: null, points_cost: null,
    })
    expect(buildPromoPayload(form({ promoType: 'REWARD', minTierId: 'tier-1', pointsCost: '500' }))).toMatchObject({
      min_tier_id: 'tier-1', points_cost: 500,
    })
  })

  it('treats an empty tier selection as all tiers', () => {
    expect(buildPromoPayload(form({ promoType: 'REWARD', pointsCost: '500' })).min_tier_id).toBeNull()
  })
})

describe('validatePromoPayload', () => {
  it('accepts each discount type with valid input', () => {
    expect(check()).toBeNull()
    expect(check({ discountType: 'percentage', value: '10' })).toBeNull()
    expect(check({ discountType: 'free_delivery' })).toBeNull()
    expect(check({ discountType: 'free_item', menuItemId: 'item-123' })).toBeNull()
  })

  it('rejects a free_item reward with no item picked', () => {
    expect(check({ discountType: 'free_item' })).toMatch(/menu item/i)
  })

  it('rejects a non-positive value for flat and percentage', () => {
    expect(check({ value: '0' })).toMatch(/positive/i)
    expect(check({ value: '' })).toMatch(/positive/i)
    expect(check({ discountType: 'percentage', value: '101' })).toMatch(/100/)
  })

  it('rejects an unknown discount type', () => {
    expect(check({ discountType: 'bogof' as never })).toMatch(/discount_type/)
  })

  it('rejects a non-zero discount_value on a free_delivery payload', () => {
    const p = buildPromoPayload(form({ discountType: 'free_delivery' }))
    expect(validatePromoPayload({ ...p, discount_value: 5 })).toMatch(/must be 0/)
  })

  it('requires a code for VOUCHER but not for REWARD', () => {
    expect(check({ code: '' })).toMatch(/Code is required/)
    expect(check({ promoType: 'REWARD', code: '', pointsCost: '500' })).toBeNull()
  })

  it('requires a positive integer points cost for REWARD', () => {
    expect(check({ promoType: 'REWARD', pointsCost: '' })).toMatch(/Points cost/)
    expect(check({ promoType: 'REWARD', pointsCost: '0' })).toMatch(/Points cost/)
  })

  it('rejects an end date on or before the start date', () => {
    expect(check({ startDate: '2026-10-02T10:00', endDate: '2026-10-01T10:00' })).toMatch(/End date/)
    expect(check({ startDate: '2026-10-01T10:00', endDate: '2026-10-02T10:00' })).toBeNull()
  })

  it('rejects a negative minimum order', () => {
    expect(check({ minOrder: '-1' })).toMatch(/minimum order/i)
    expect(check({ minOrder: '' })).toMatch(/minimum order/i)
  })
})
