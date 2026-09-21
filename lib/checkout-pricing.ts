// Server-side pricing for checkout. The browser sends prices only so we can tell the
// customer when they are stale; every amount that is charged comes from here.

import { PRICED_CATEGORIES, unitPrice, type PricedCategoryKey, type PricedOption, type SelectedExtra } from './order-modifiers'

export type PricingMenuRow = {
  id: string
  name: string
  price: number | string
  /** legacy flat extras, still read so rows saved before the categorized columns work */
  extras?: PricedOption[] | null
  sold_out_extras?: string[] | null
} & Partial<Record<PricedCategoryKey, PricedOption[] | null>>

export interface CartLineInput {
  menu_item_id?: string
  name: string
  price: number
  quantity: number
  totalPrice: number
  extras?: SelectedExtra[]
}

export type PricingResult<T> = { ok: true; lines: T[]; subtotal: number } | { ok: false; error: string }

const round2 = (n: number) => Math.round(n * 100) / 100
const isQty = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 99

const MAX_LINES = 50
const MAX_EXTRAS_PER_LINE = 30

function findOption(row: PricingMenuRow, extra: SelectedExtra): PricedOption | undefined {
  let pools: (PricedOption[] | null | undefined)[]
  if (extra.category === undefined) {
    pools = [...PRICED_CATEGORIES.map((c) => row[c.key]), row.extras]
  } else {
    const cat = PRICED_CATEGORIES.find((c) => c.key === extra.category)
    if (!cat) return undefined
    pools = cat.key === 'add_ons' ? [row.add_ons, row.extras] : [row[cat.key]]
  }
  for (const pool of pools) {
    const hit = pool?.find((o) => o.name === extra.name)
    if (hit) return hit
  }
  return undefined
}

/**
 * Reprices every line from the menu rows. Fails (never silently corrects) when the
 * client sent something we cannot honour, so the customer is charged exactly what
 * they were shown.
 */
export function priceCartLines<T extends CartLineInput>(
  lines: T[],
  menuById: Map<string, PricingMenuRow>,
): PricingResult<T> {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: 'Your cart is empty.' }
  if (lines.length > MAX_LINES) return { ok: false, error: 'Too many items in one order.' }

  const priced: T[] = []
  for (const line of lines) {
    const row = line.menu_item_id ? menuById.get(line.menu_item_id) : undefined
    if (!row) return { ok: false, error: 'An item in your cart is no longer on the menu. Please review your cart.' }
    if (!isQty(line.quantity)) return { ok: false, error: `Invalid quantity for ${row.name}.` }

    const submitted = line.extras ?? []
    if (submitted.length > MAX_EXTRAS_PER_LINE) return { ok: false, error: `Too many extras on ${row.name}.` }

    const extras: SelectedExtra[] = []
    for (const e of submitted) {
      if (e.qty !== undefined && !isQty(e.qty)) return { ok: false, error: `Invalid quantity for ${e.name} on ${row.name}.` }
      const option = findOption(row, e)
      if (!option) return { ok: false, error: `Sorry, ${e.name} is not available on ${row.name}. Please update your order.` }
      extras.push({ ...e, price: Number(option.price) })
    }

    const unit = unitPrice(Number(row.price), extras)
    if (!(Math.abs(Number(line.price) - unit) <= 0.01)) {
      return { ok: false, error: `Prices have changed since you added ${row.name}. Please review your cart.` }
    }

    priced.push({ ...line, name: row.name, price: unit, totalPrice: round2(unit * line.quantity), extras })
  }

  return { ok: true, lines: priced, subtotal: round2(priced.reduce((s, l) => s + l.totalPrice, 0)) }
}

export interface DeliveryZone {
  postcode_prefix: string
  delivery_fee: number | string
  free_delivery_threshold?: number | string | null
}

/** Same zone match as GET /api/delivery-zones: first active prefix (A→Z) the postcode starts with. */
export function deliveryFeeFor(args: {
  orderType: string | undefined
  postcode: string | undefined
  zones: DeliveryZone[]
  subtotal: number
}): { ok: true; fee: number } | { ok: false; error: string } {
  if (args.orderType === 'pickup') return { ok: true, fee: 0 }

  const normalized = (args.postcode ?? '').trim().toUpperCase()
  const zone = [...args.zones]
    .sort((a, b) => a.postcode_prefix.localeCompare(b.postcode_prefix))
    .find((z) => normalized !== '' && normalized.startsWith(z.postcode_prefix.toUpperCase()))
  if (!zone) return { ok: false, error: 'Sorry, we do not deliver to that postcode.' }

  const threshold = Number(zone.free_delivery_threshold ?? 0)
  if (threshold > 0 && args.subtotal >= threshold) return { ok: true, fee: 0 }
  return { ok: true, fee: Number(zone.delivery_fee) }
}

/**
 * Rebuilds a past order line at today's prices (reorder). Extras the item no longer
 * offers, or that are sold out, are dropped rather than carried over stale.
 */
export function repriceLine<T extends { quantity: number; extras?: SelectedExtra[] | null }>(line: T, row: PricingMenuRow) {
  const soldOut = row.sold_out_extras ?? []
  const extras = (line.extras ?? []).flatMap((e) => {
    const option = findOption(row, e)
    return option && !soldOut.includes(e.name) ? [{ ...e, price: Number(option.price) }] : []
  })
  const unit = unitPrice(Number(row.price), extras)
  return { ...line, name: row.name, price: unit, totalPrice: round2(unit * line.quantity), extras }
}
