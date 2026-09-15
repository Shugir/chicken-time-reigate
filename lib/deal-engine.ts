export type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'

export interface MenuItemLite {
  id: string
  price: number
  category: string
  is_available: boolean
}

export interface DealCartItem {
  menu_item_id?: string
  quantity: number
}

export interface Deal {
  id: string
  type: DealType
  name: string
  config: unknown
  is_active: boolean
}

export interface AppliedDeal {
  deal_id: string
  name: string
  type: DealType
  savings: number
}

interface Ref {
  category?: string
  item_ids?: string[]
}

interface BogoConfig {
  buy: Ref & { qty: number }
  get: Ref & { qty: number; discount: 'free' | { percent: number } }
}

interface BundleConfig {
  groups: { label: string; category: string; pick_qty: number }[]
  price: number
}

interface FixedMealConfig {
  items: { item_id: string; qty: number }[]
  price: number
}

interface OrderDiscountConfig {
  scope: 'order' | 'category'
  category?: string
  min_subtotal?: number
  discount: { type: 'percent' | 'amount'; value: number }
}

interface Unit {
  menu_item_id: string
  category: string
  price: number
  consumed: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function matchesRef(unit: Unit, ref: Ref): boolean {
  if (ref.item_ids && ref.item_ids.length > 0) return ref.item_ids.includes(unit.menu_item_id)
  if (ref.category) return unit.category === ref.category
  return false
}

function sameRef(a: Ref, b: Ref): boolean {
  if (a.item_ids && b.item_ids) {
    return a.item_ids.length === b.item_ids.length && a.item_ids.every((id) => b.item_ids!.includes(id))
  }
  return Boolean(a.category) && a.category === b.category
}

function priceAfterDiscount(price: number, discount: 'free' | { percent: number }): number {
  return discount === 'free' ? price : price * (discount.percent / 100)
}

function evaluateItemDeal(deal: Deal, available: Unit[]): { savings: number; consume: Unit[] } | null {
  if (deal.type === 'bogo') {
    const cfg = deal.config as BogoConfig
    const buyPool = available.filter((u) => matchesRef(u, cfg.buy))
    const getPool = available.filter((u) => matchesRef(u, cfg.get))

    if (sameRef(cfg.buy, cfg.get)) {
      const groupSize = cfg.buy.qty + cfg.get.qty
      const applications = Math.floor(buyPool.length / groupSize)
      if (applications < 1) return null
      const sorted = [...buyPool].sort((a, b) => b.price - a.price)
      const getUnits = sorted.slice(0, applications * cfg.get.qty)
      const buyUnits = sorted.slice(applications * cfg.get.qty, applications * groupSize)
      const savings = getUnits.reduce((s, u) => s + priceAfterDiscount(u.price, cfg.get.discount), 0)
      return savings > 0 ? { savings, consume: getUnits } : null
    }

    const applications = Math.min(
      Math.floor(buyPool.length / cfg.buy.qty),
      Math.floor(getPool.length / cfg.get.qty),
    )
    if (applications < 1) return null
    const getUnits = [...getPool].sort((a, b) => b.price - a.price).slice(0, applications * cfg.get.qty)
    const buyUnits = [...buyPool].sort((a, b) => b.price - a.price).slice(0, applications * cfg.buy.qty)
    const savings = getUnits.reduce((s, u) => s + priceAfterDiscount(u.price, cfg.get.discount), 0)
    return savings > 0 ? { savings, consume: [...getUnits, ...buyUnits] } : null
  }

  if (deal.type === 'bundle') {
    const cfg = deal.config as BundleConfig
    const consume: Unit[] = []
    let sum = 0
    for (const group of cfg.groups) {
      const pool = available
        .filter((u) => !consume.includes(u) && u.category === group.category)
        .sort((a, b) => b.price - a.price)
      if (pool.length < group.pick_qty) return null
      const picked = pool.slice(0, group.pick_qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume } : null
  }

  if (deal.type === 'fixed_meal') {
    const cfg = deal.config as FixedMealConfig
    const consume: Unit[] = []
    let sum = 0
    for (const req of cfg.items) {
      const pool = available.filter((u) => !consume.includes(u) && u.menu_item_id === req.item_id)
      if (pool.length < req.qty) return null
      const picked = pool.slice(0, req.qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume } : null
  }

  return null
}

/**
 * Pure matching engine. Runs item-consuming deals (bogo/bundle/fixed_meal)
 * greedily by best marginal savings first, then applies the single best
 * order_discount deal (if any) against whatever subtotal remains.
 *
 * ponytail: greedy best-marginal-savings, not an exhaustive search over all
 * deal combinations — correct/tied-optimal at realistic scale (a handful of
 * concurrent deals, single-digit cart lines). Revisit if the deal catalog
 * grows past ~20 concurrently active deals.
 */
export function matchDeals(
  cartItems: DealCartItem[],
  activeDeals: Deal[],
  menuItemsById: Map<string, MenuItemLite>,
): { applied: AppliedDeal[]; totalDiscount: number } {
  const units: Unit[] = []
  for (const item of cartItems) {
    if (!item.menu_item_id) continue
    const db = menuItemsById.get(item.menu_item_id)
    if (!db || !db.is_available) continue
    for (let i = 0; i < item.quantity; i++) {
      units.push({ menu_item_id: db.id, category: db.category, price: db.price, consumed: false })
    }
  }

  const originalSubtotal = units.reduce((s, u) => s + u.price, 0)
  const applied: AppliedDeal[] = []
  let totalDiscount = 0

  const itemDeals = activeDeals.filter((d) => d.is_active && d.type !== 'order_discount')
  const orderDeals = activeDeals.filter((d) => d.is_active && d.type === 'order_discount')

  for (;;) {
    const available = units.filter((u) => !u.consumed)
    let best: { deal: Deal; savings: number; consume: Unit[] } | null = null

    for (const deal of itemDeals) {
      const result = evaluateItemDeal(deal, available)
      if (result && result.savings > 0 && (!best || result.savings > best.savings)) {
        best = { deal, savings: result.savings, consume: result.consume }
      }
    }

    if (!best) break
    best.consume.forEach((u) => { u.consumed = true })
    applied.push({ deal_id: best.deal.id, name: best.deal.name, type: best.deal.type, savings: round2(best.savings) })
    totalDiscount += best.savings
  }

  const remaining = units.filter((u) => !u.consumed)
  let bestOrderDeal: { deal: Deal; savings: number } | null = null
  for (const deal of orderDeals) {
    const cfg = deal.config as OrderDiscountConfig
    if (cfg.min_subtotal && originalSubtotal < cfg.min_subtotal) continue
    const pool = cfg.scope === 'category' ? remaining.filter((u) => u.category === cfg.category) : remaining
    if (pool.length === 0) continue
    const poolSum = pool.reduce((s, u) => s + u.price, 0)
    const savings = cfg.discount.type === 'percent'
      ? poolSum * (cfg.discount.value / 100)
      : Math.min(cfg.discount.value, poolSum)
    if (savings > 0 && (!bestOrderDeal || savings > bestOrderDeal.savings)) {
      bestOrderDeal = { deal, savings }
    }
  }
  if (bestOrderDeal) {
    applied.push({
      deal_id: bestOrderDeal.deal.id,
      name: bestOrderDeal.deal.name,
      type: 'order_discount',
      savings: round2(bestOrderDeal.savings),
    })
    totalDiscount += bestOrderDeal.savings
  }

  return { applied, totalDiscount: round2(totalDiscount) }
}
