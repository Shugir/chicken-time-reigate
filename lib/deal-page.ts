// Pure helpers for the meal deal page (/order/deal/[dealId]) and the MEAL DEAL row on /order.

import { inSlot, type BundleConfig, type BundleSlot, type BundleUpgrades } from './deal-engine'

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

/** Anything with slots: a bundle deal or a DealView. */
type HasGroups = { config: { groups: DealGroup[] } }

/** Index of the first slot holding the item, or -1. */
export function lockedSlotIndex(deal: HasGroups, item: ItemRef): number {
  return deal.config.groups.findIndex((g) => inSlot(slotOf(g), item))
}

/** Items the customer can pick in a slot. The locked item's slot offers only that item. */
export function slotItems<T extends ItemRef & { is_available?: boolean }>(
  deal: HasGroups, groupIndex: number, items: T[], lockedItem?: T,
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

type BogoSide = { qty: number; item_ids?: string[]; category?: string }
export interface BogoDeal {
  id: string
  type: 'bogo'
  name: string
  config: { buy: BogoSide; get: BogoSide & { discount: 'free' | { percent: number } } }
}

/** Active BOGO deals the item can start: it is on the deal's Buy side (by id or category). */
export function bogosFor(deals: { type: string }[], item: ItemRef): BogoDeal[] {
  return deals.filter(
    (d): d is BogoDeal => d.type === 'bogo' && inSlot({ item_ids: (d as BogoDeal).config.buy.item_ids ?? [], category: (d as BogoDeal).config.buy.category }, item),
  )
}

/** "free", "half price", "30% off". */
function offText(d: 'free' | { percent: number }): string {
  return d === 'free' ? 'free' : d.percent === 50 ? 'half price' : `${d.percent}% off`
}
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Buy 1, get 1 half price", "Buy 2, get 1 free", "Buy 1, get 2 at 30% off". */
export function bogoLabel(config: { buy: { qty: number }; get: { qty: number; discount: 'free' | { percent: number } } }): string {
  const d = config.get.discount
  const off = d !== 'free' && d.percent !== 50 ? `at ${offText(d)}` : offText(d)
  return `Buy ${config.buy.qty}, get ${config.get.qty} ${off}`
}

/** "Half price", "Free", "30% off": the short BOGO text for the menu card's deal row. */
export function bogoShortLabel(config: BogoDeal['config']): string {
  return capitalise(offText(config.get.discount))
}

export type PageDeal = BundleDeal | BogoDeal

/** Every active bundle or BOGO deal the item can be part of: bundles first, then BOGOs (either side). */
export function dealsForItem(deals: { type: string }[], item: ItemRef): PageDeal[] {
  const bogos = deals.filter(
    (d): d is BogoDeal => d.type === 'bogo' && [(d as BogoDeal).config.buy, (d as BogoDeal).config.get]
      .some((side) => inSlot({ item_ids: side.item_ids ?? [], category: side.category }, item)),
  )
  return [...bundlesContaining(deals, item), ...bogos]
}

/** A deal as the deal page shows it: slots to fill, whatever the deal type. */
export interface DealView {
  id: string
  name: string
  /** Tab text: "£12.99", "20% off", "Buy 1, get 1 half price". */
  priceLabel: string
  /** Hero text under the deal name. */
  headline: string
  /** Hero image badge. */
  badge: string
  /** note: the slot header's right-hand text, e.g. "Included in deal", "Half price". */
  config: { groups: (DealGroup & { note: string })[]; upgrades?: BundleUpgrades }
  /** The deal as the checkout engine sees it, for the saving. */
  engine: { id: string; type: 'bundle' | 'bogo'; name: string; config: unknown; is_active: true }
}

export function dealView(d: PageDeal): DealView {
  const engine = { id: d.id, type: d.type, name: d.name, config: d.config, is_active: true as const }
  if (d.type === 'bundle') {
    const priceLabel = dealPriceLabel(d.config)
    return {
      id: d.id, name: d.name, priceLabel, engine, badge: 'MEAL DEAL',
      headline: d.config.price_type === 'percent' ? `${priceLabel} selected items` : `${priceLabel} meal deal`,
      config: { groups: d.config.groups.map((g) => ({ ...g, note: 'Included in deal' })), upgrades: d.config.upgrades },
    }
  }
  const { buy, get } = d.config
  const side = (label: string, s: BogoSide, note: string) =>
    ({ label, min_qty: s.qty, max_qty: s.qty, item_ids: s.item_ids, category: s.category, note })
  return {
    id: d.id, name: d.name, priceLabel: bogoLabel(d.config), headline: bogoLabel(d.config), engine, badge: 'OFFER',
    config: {
      groups: [
        side(`Buy ${buy.qty}`, buy, 'Included in deal'),
        side(`Get ${get.qty}`, get, capitalise(offText(get.discount))),
      ],
    },
  }
}
