// Shared contract for the categorized item customizer (Phase 2).
// Every surface that builds, prices or displays a customized order line uses this file.

export type SelectMode = 'single' | 'multi'

export const PRICED_CATEGORIES = [
  { key: 'extra_ingredients', label: 'Extra Ingredients' },
  { key: 'drinks_regular', label: 'Drinks (Regular)' },
  { key: 'drinks_large', label: 'Drinks (Large)' },
  { key: 'sides', label: 'Sides' },
  { key: 'fries_regular', label: 'Fries (Regular)' },
  { key: 'fries_large', label: 'Fries (Large)' },
  { key: 'dips', label: 'Dips' },
  { key: 'add_ons', label: 'Add-ons' },
  { key: 'other_extras', label: 'Other Extras' },
] as const

export type PricedCategoryKey = (typeof PRICED_CATEGORIES)[number]['key']

// Matches the menu_items.modifier_select_modes column default
export const DEFAULT_SELECT_MODES: Record<string, SelectMode> = {
  spicy_levels: 'single', dips: 'single', fries_regular: 'single', fries_large: 'single',
  add_ons: 'multi', drinks_regular: 'multi', drinks_large: 'multi', sides: 'multi', other_extras: 'multi',
  extra_ingredients: 'multi',
}

/** `description` is a short subtitle, `badge` a short highlight tag ("Chef Choice", "15,000 SHU"). */
export interface PricedOption { name: string; price: number; description?: string; badge?: string }

/** One chosen extra. `qty` missing means 1 (rows written before Phase 2 have no qty). */
export interface SelectedExtra extends PricedOption { qty?: number; category?: string }

/** menu_items fields the customizer reads. All optional so legacy rows and old API shapes still work. */
export type ModifierSource = {
  spicy_levels?: PricedOption[] | null
  ingredients?: string[] | null
  removals?: string[] | null
  additions?: string[] | null
  extras?: PricedOption[] | null
  modifier_select_modes?: Record<string, SelectMode> | null
} & Partial<Record<PricedCategoryKey, PricedOption[] | null>>

export interface ModifierCategory {
  key: PricedCategoryKey
  label: string
  options: PricedOption[]
  mode: SelectMode
}

/** What the drawer renders. Empty sections are omitted or empty arrays. */
export interface ModifierConfig {
  spicyLevels: PricedOption[]
  spicyMode: SelectMode
  ingredients: string[]
  additions: string[]
  categories: ModifierCategory[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const extraQty = (e: { qty?: number }): number => (e.qty && e.qty > 0 ? e.qty : 1)

export function extrasTotal(extras: { price: number; qty?: number }[]): number {
  return round2(extras.reduce((sum, e) => sum + e.price * extraQty(e), 0))
}

/** Unit price of one item including its extras. Multiply by quantity for the line total. */
export function unitPrice(base: number, extras: { price: number; qty?: number }[]): number {
  return round2(base + extrasTotal(extras))
}

/**
 * Price of the chosen spicy level, 0 when none is chosen or the item does not offer it.
 * The level travels as a plain name (order_items.spicy_level), so its price is looked up
 * here and folded into the base: `unitPrice(base + spicyPrice(...), extras)`.
 */
export function spicyPrice(levels: PricedOption[] | null | undefined, name: string | null | undefined): number {
  return Number(levels?.find((l) => l.name === name)?.price ?? 0)
}

/** "Coke ×2", or just "Coke" when qty is 1 or missing. */
export function formatExtra(e: { name: string; qty?: number }): string {
  const q = extraQty(e)
  return q > 1 ? `${e.name} ×${q}` : e.name
}

export function toModifierConfig(src: ModifierSource): ModifierConfig {
  const modes = { ...DEFAULT_SELECT_MODES, ...(src.modifier_select_modes ?? {}) }
  const nonEmpty = (list: unknown[] | null | undefined) => Array.isArray(list) && list.length > 0

  // Legacy fallback: rows saved before Phase 1 only have removals/extras
  const ingredients = nonEmpty(src.ingredients) ? src.ingredients! : (src.removals ?? [])
  const withLegacy: Partial<Record<PricedCategoryKey, PricedOption[] | null>> = {
    ...src,
    add_ons: nonEmpty(src.add_ons) ? src.add_ons : (src.extras ?? []),
  }

  return {
    spicyLevels: src.spicy_levels ?? [],
    spicyMode: modes.spicy_levels,
    ingredients,
    additions: src.additions ?? [],
    categories: PRICED_CATEGORIES
      .map((c) => ({ key: c.key, label: c.label, options: withLegacy[c.key] ?? [], mode: modes[c.key] }))
      .filter((c) => c.options.length > 0),
  }
}
