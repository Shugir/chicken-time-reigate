import type { ProductItem, AddOn } from '@/components/ProductModal'
import { spicyPrice, toModifierConfig, unitPrice, type ModifierConfig, type ModifierSource } from './order-modifiers'

export type MenuItem = ProductItem & {
  dietaryFlags?: string[]
  compare_at_price?: number | null
  is_available?: boolean
  sold_out_extras?: string[]
}

export const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80'

// ModifierSource carries the Phase 1 columns (spicy_levels, ingredients, the 8 priced
// categories, modifier_select_modes) plus the legacy extras/removals/additions.
export type DbMenuItem = ModifierSource & {
  id: string
  name: string
  description: string | null
  price: number
  compare_at_price: number | null
  image_url: string | null
  category: string
  is_available: boolean
  sold_out_extras: string[]
  dietary_flags: string[] | null
  allergens: string[] | null
  custom_options: {
    emoji?: string
    badge?: string
    allergens?: string[]
    removables?: string[]
    add_ons?: Array<{ name: string; price: number }>
  } | null
}

export function dbToMenuItem(item: DbMenuItem): MenuItem {
  const opts = item.custom_options ?? {}
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: Number(item.price),
    compare_at_price: item.compare_at_price != null ? Number(item.compare_at_price) : null,
    category: item.category.toLowerCase(),
    badge: opts.badge,
    emoji: opts.emoji ?? '🍽️',
    image: item.image_url || FALLBACK_IMG,
    allergens: item.allergens?.length ? item.allergens : (opts.allergens ?? []),
    removables: item.removals?.length ? item.removals : (opts.removables ?? []),
    additions: item.additions ?? [],
    add_ons: item.add_ons?.length ? item.add_ons : item.extras?.length ? item.extras : (opts.add_ons ?? []),
    modifiers: toModifierConfig(item),
    dietaryFlags: item.dietary_flags ?? [],
    is_available: item.is_available,
    sold_out_extras: item.sold_out_extras ?? [],
  }
}

/** Unit price of a cart line: base + chosen spicy level + extras. Must match lib/checkout-pricing. */
export function lineUnitPrice(item: MenuItem, entry: { spicy_level?: string; extras: AddOn[] }) {
  return unitPrice(item.price + spicyPrice(item.modifiers?.spicyLevels, entry.spicy_level), entry.extras)
}

/** The item's option config. Rows without Phase 1 data (and the static fallback menu) use the legacy lists. */
export function itemConfig(item: MenuItem): ModifierConfig {
  return item.modifiers ?? toModifierConfig({ removals: item.removables, additions: item.additions, extras: item.add_ons })
}
