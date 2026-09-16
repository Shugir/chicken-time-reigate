export type PromoType     = 'VOUCHER' | 'REWARD' | 'AUTO_APPLY'
export type DiscountType  = 'flat' | 'percentage' | 'free_delivery' | 'free_item'

export const DISCOUNT_TYPES: DiscountType[] = ['flat', 'percentage', 'free_delivery', 'free_item']

// free_delivery/free_item carry their value in reward_config, not discount_value —
// the DB CHECK only allows a zero discount_value for those two.
export function usesDiscountValue(t: DiscountType): boolean {
  return t === 'flat' || t === 'percentage'
}

export interface PromoFormInput {
  promoType:    PromoType
  code:         string
  discountType: DiscountType
  value:        string
  minOrder:     string
  pointsCost:   string
  minTierId:    string
  menuItemId:   string
  startDate:    string
  endDate:      string
}

export interface PromoPayload {
  code:             string | null
  promo_type:       PromoType
  discount_type:    DiscountType
  discount_value:   number
  min_order_amount: number
  points_cost:      number | null
  min_tier_id:      string | null
  reward_config:    Record<string, unknown>
  start_date:       string | null
  end_date:         string | null
}

export function buildPromoPayload(f: PromoFormInput): PromoPayload {
  return {
    code:             f.code.trim() ? f.code.trim().toUpperCase() : null,
    promo_type:       f.promoType,
    discount_type:    f.discountType,
    discount_value:   usesDiscountValue(f.discountType) ? parseFloat(f.value) : 0,
    min_order_amount: parseFloat(f.minOrder),
    points_cost:      f.promoType === 'REWARD' ? parseInt(f.pointsCost, 10) : null,
    min_tier_id:      f.promoType === 'REWARD' && f.minTierId ? f.minTierId : null,
    reward_config:    f.discountType === 'free_item' ? { menu_item_id: f.menuItemId } : {},
    start_date:       f.startDate || null,
    end_date:         f.endDate   || null,
  }
}

export function validatePromoPayload(p: PromoPayload): string | null {
  if (!DISCOUNT_TYPES.includes(p.discount_type)) {
    return `discount_type must be one of ${DISCOUNT_TYPES.join(', ')}`
  }
  if (p.promo_type === 'VOUCHER' && !p.code) return 'Code is required for VOUCHER type.'
  if (p.promo_type === 'REWARD') {
    if (!Number.isInteger(p.points_cost) || (p.points_cost ?? 0) <= 0) {
      return 'Points cost must be a positive integer for REWARD type.'
    }
  }

  if (usesDiscountValue(p.discount_type)) {
    if (!Number.isFinite(p.discount_value) || p.discount_value <= 0) {
      return 'Discount value must be positive.'
    }
    if (p.discount_type === 'percentage' && p.discount_value > 100) {
      return 'Percentage cannot exceed 100.'
    }
  } else if (p.discount_value !== 0) {
    return `discount_value must be 0 for ${p.discount_type}.`
  }

  if (p.discount_type === 'free_item') {
    const itemId = p.reward_config?.menu_item_id
    if (typeof itemId !== 'string' || !itemId.trim()) {
      return 'Pick the menu item this reward gives away.'
    }
  }

  if (!Number.isFinite(p.min_order_amount) || p.min_order_amount < 0) {
    return 'Invalid minimum order amount.'
  }
  if (p.start_date && p.end_date && new Date(p.end_date) <= new Date(p.start_date)) {
    return 'End date must be after start date.'
  }
  return null
}
