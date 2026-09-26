// Pure helpers for the meal deal page (/order/deal/[dealId]) and the MEAL DEAL row on /order.

import { inSlot, type BundleConfig, type BundleSlot } from './deal-engine'

/** A bundle slot as stored: category-only slots may have no item_ids. */
export type DealGroup = Omit<BundleSlot, 'item_ids'> & { item_ids?: string[] }

export interface BundleDeal {
  id: string
  type: 'bundle'
  name: string
  config: Omit<BundleConfig, 'groups'> & { groups: DealGroup[] }
}

type ItemRef = { id: string; category: string }

const slotOf = (g: DealGroup) => ({ item_ids: g.item_ids ?? [], category: g.category })

/** The active bundle deals that have a slot holding this item, in the order given. */
export function bundlesContaining(deals: { type: string }[], item: ItemRef): BundleDeal[] {
  return deals.filter(
    (d): d is BundleDeal => d.type === 'bundle' && (d as BundleDeal).config.groups.some((g) => inSlot(slotOf(g), item)),
  )
}

/** Index of the first slot holding the item, or -1. */
export function lockedSlotIndex(deal: BundleDeal, item: ItemRef): number {
  return deal.config.groups.findIndex((g) => inSlot(slotOf(g), item))
}

/** Items the customer can pick in a slot. The locked item's slot offers only that item. */
export function slotItems<T extends ItemRef & { is_available?: boolean }>(
  deal: BundleDeal, groupIndex: number, items: T[], lockedItem?: T,
): T[] {
  if (lockedItem && lockedSlotIndex(deal, lockedItem) === groupIndex) return [lockedItem]
  const group = deal.config.groups[groupIndex]
  return items.filter((i) => i.is_available !== false && inSlot(slotOf(group), i))
}

/** "£12.99" or "20% off". */
export function dealPriceLabel(config: Pick<BundleConfig, 'price' | 'price_type' | 'discount_percent'>): string {
  return config.price_type === 'percent' ? `${config.discount_percent}% off` : `£${config.price.toFixed(2)}`
}

/** The MEAL DEAL row's price: "from £x" (lowest fixed price) when two or more deals are fixed-price. */
export function cardDealLabel(bundles: BundleDeal[]): string | null {
  if (bundles.length === 0) return null
  const fixed = bundles.filter((b) => b.config.price_type !== 'percent').map((b) => b.config.price)
  if (fixed.length >= 2) return `from £${Math.min(...fixed).toFixed(2)}`
  return dealPriceLabel(bundles[0].config)
}
