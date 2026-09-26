// Server-side validation for admin menu item create (POST) and update (PATCH).
import { PRICED_CATEGORIES } from './order-modifiers'

const OPTION_LISTS: Record<string, string> = {
  spicy_levels: 'Spicy Level',
  extras: 'Extras',
  ...Object.fromEntries(PRICED_CATEGORIES.map((c) => [c.key, c.label])),
}

const STRING_LISTS: Record<string, string> = {
  ingredients: 'Ingredients', removals: 'Removals', additions: 'Additions',
  dietary_flags: 'Dietary flags', allergens: 'Allergens', sold_out_extras: 'Sold-out options',
}

const SELECT_MODES = new Set(['single', 'multi', 'pick'])
const MAX_OPTIONS = 50

type Result = { ok: true; value: Record<string, unknown> } | { ok: false; error: string }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function checkField(key: string, v: unknown): string | null {
  switch (key) {
    case 'name':
      if (typeof v !== 'string' || !v.trim()) return 'Name is required'
      return v.trim().length > 80 ? 'Name must be 80 characters or fewer' : null
    case 'price':
      if (!isNum(v)) return 'Price must be a number'
      if (v <= 0) return 'Price must be more than £0.00'
      return v > 1000 ? 'Price must be £1000.00 or less' : null
    case 'compare_at_price':
      if (v === null) return null
      if (!isNum(v)) return 'Compare-at price must be a number'
      return v > 0 ? null : 'Compare-at price must be more than £0.00'
    case 'category':
      return typeof v === 'string' && v.trim() ? null : 'Category is required'
    case 'description':
      return v === null || typeof v === 'string' ? null : 'Description must be text'
    case 'image_url':
      return v === null || typeof v === 'string' ? null : 'Image URL must be text'
    case 'is_available':
      return typeof v === 'boolean' ? null : 'Availability must be true or false'
    case 'modifier_select_modes': {
      if (!isObj(v)) return 'Choice styles must be an object'
      const bad = Object.values(v).find((m) => typeof m !== 'string' || !SELECT_MODES.has(m))
      return bad === undefined ? null : `Unknown choice style: ${String(bad)}`
    }
  }
  if (key in STRING_LISTS) {
    return Array.isArray(v) && v.every((s) => typeof s === 'string') ? null : `${STRING_LISTS[key]} must be a list of text`
  }
  const label = OPTION_LISTS[key]
  if (!Array.isArray(v)) return `${label} must be a list`
  if (v.length > MAX_OPTIONS) return `${label}: at most ${MAX_OPTIONS} options`
  for (const o of v) {
    if (!isObj(o) || typeof o.name !== 'string' || !o.name.trim()) return `${label}: every option needs a name`
    if (!isNum(o.price) || o.price < 0) return `${label}: every option needs a price of £0.00 or more`
    if ((o.description !== undefined && typeof o.description !== 'string') || (o.badge !== undefined && typeof o.badge !== 'string')) {
      return `${label}: option details must be text`
    }
  }
  return null
}

const ALLOWED = new Set([
  'name', 'price', 'compare_at_price', 'category', 'description', 'image_url', 'is_available', 'modifier_select_modes',
  ...Object.keys(STRING_LISTS), ...Object.keys(OPTION_LISTS),
])

/** Allow-lists and checks a menu item body. `partial` (PATCH) makes name, price and category optional. */
export function validateMenuItemInput(body: unknown, { partial }: { partial: boolean }): Result {
  if (!isObj(body)) return { ok: false, error: 'Invalid body' }
  if (!partial) {
    if (body.name === undefined) return { ok: false, error: 'Name is required' }
    if (body.price === undefined) return { ok: false, error: 'Price is required' }
    if (body.category === undefined) return { ok: false, error: 'Category is required' }
  }
  const value: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(body)) {
    if (!ALLOWED.has(key) || v === undefined) continue
    const error = checkField(key, v)
    if (error) return { ok: false, error }
    value[key] = key === 'name' ? (v as string).trim() : v
  }
  return { ok: true, value }
}
