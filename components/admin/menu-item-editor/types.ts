import type { PricedOption, SelectMode } from '@/lib/order-modifiers'

export type { SelectMode }

/** A priced option: `description` is a short subtitle, `badge` a short highlight tag ("Chef Choice"). */
export type Extra = PricedOption

export interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  compare_at_price: number | null
  image_url: string | null
  category: string
  is_available: boolean
  sold_out_extras: string[]
  /** @deprecated use add_ons */
  extras: Extra[]
  /** @deprecated use ingredients */
  removals: string[]
  additions: string[]
  spicy_levels: Extra[]
  ingredients: string[]
  extra_ingredients: Extra[]
  add_ons: Extra[]
  drinks_regular: Extra[]
  drinks_large: Extra[]
  dips: Extra[]
  sides: Extra[]
  fries_regular: Extra[]
  fries_large: Extra[]
  other_extras: Extra[]
  modifier_select_modes: Record<string, SelectMode>
  dietary_flags: string[]
  allergens: string[]
  created_at: string
}

export interface DbCategory { id: string; name: string; slug: string; sort_order: number; is_active: boolean }
