import { describe, it, expect } from 'vitest'
import { matchDeals, isDealLive, inSlot, bundleTotal, type Deal, type MenuItemLite, type DealCartItem } from './deal-engine'

function menuMap(items: MenuItemLite[]): Map<string, MenuItemLite> {
  return new Map(items.map((i) => [i.id, i]))
}

describe('matchDeals — bogo', () => {
  it('applies buy-one-get-one-free on the same item', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0].name).toBe('BOGO Wings')
    expect(result.totalDiscount).toBe(5)
  })

  it('does not apply when quantity is insufficient', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
    expect(result.totalDiscount).toBe(0)
  })

  it('applies across two different items (buy fries get drink 50% off)', () => {
    const menuItems = menuMap([
      { id: 'fries', price: 3, category: 'sides', is_available: true },
      { id: 'cola',  price: 2, category: 'drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'Fries + Half Price Drink', is_active: true,
      config: {
        buy: { item_ids: ['fries'], qty: 1 },
        get: { item_ids: ['cola'], qty: 1, discount: { percent: 50 } },
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'fries', quantity: 1 }, { menu_item_id: 'cola', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.totalDiscount).toBe(1)
  })
})

describe('matchDeals — bogo with overlapping buy/get item lists', () => {
  const menuItems = menuMap([
    { id: 'a', price: 4, category: 'x', is_available: true },
    { id: 'b', price: 6, category: 'x', is_available: true },
    { id: 'c', price: 8, category: 'x', is_available: true },
  ])
  const deals: Deal[] = [{
    id: 'd1', type: 'bogo', name: 'Overlap', is_active: true,
    config: { buy: { item_ids: ['a', 'b'], qty: 1 }, get: { item_ids: ['b', 'c'], qty: 1, discount: 'free' } },
  }]

  it('never uses one unit as both the bought and the free item', () => {
    // one b alone cannot pay for itself
    expect(matchDeals([{ menu_item_id: 'b', quantity: 1 }], deals, menuItems).totalDiscount).toBe(0)
  })

  it('gives the highest-priced get item free when a distinct buy unit exists', () => {
    const cart: DealCartItem[] = [{ menu_item_id: 'a', quantity: 1 }, { menu_item_id: 'c', quantity: 1 }]
    expect(matchDeals(cart, deals, menuItems).totalDiscount).toBe(8)
  })

  it('reuses a b unit as the buy when c is the free one', () => {
    const cart: DealCartItem[] = [{ menu_item_id: 'b', quantity: 1 }, { menu_item_id: 'c', quantity: 1 }]
    expect(matchDeals(cart, deals, menuItems).totalDiscount).toBe(8)
  })
})

describe('matchDeals — bundle', () => {
  it('consumes exactly min_qty of the highest-priced qualifying items per group', () => {
    const menuItems = menuMap([
      { id: 'chicken-a', price: 6, category: 'chicken', is_available: true },
      { id: 'chicken-b', price: 8, category: 'chicken', is_available: true },
      { id: 'side-a',    price: 2, category: 'sides',   is_available: true },
      { id: 'drink-a',   price: 1.5, category: 'drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['chicken-a', 'chicken-b'] },
          { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['side-a'] },
          { label: 'Drink', min_qty: 1, max_qty: 1, item_ids: ['drink-a'] },
        ],
        price: 9,
      },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'chicken-a', quantity: 1 },
      { menu_item_id: 'chicken-b', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 1 },
      { menu_item_id: 'drink-a', quantity: 1 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // Picks chicken-b (£8, pricier main) into the bundle: 8+2+1.5=11.5 - 9 = 2.5 savings
    expect(result.totalDiscount).toBe(2.5)
  })

  it('does not apply when a group has too few qualifying items for min_qty', () => {
    const menuItems = menuMap([{ id: 'chicken-a', price: 6, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['chicken-a'] },
          { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['side-a'] },
        ],
        price: 5,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'chicken-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })

  it('regression: never consumes more than min_qty even when max_qty and cart supply allow more', () => {
    // This is the discount-inflation bug the architect review caught: with a
    // fixed bundle price, consuming more units always increases savings, so
    // an up-to-max_qty engine would always grab max_qty when available —
    // awarding a bigger discount than the customer chose in the picker.
    const menuItems = menuMap([
      { id: 'side-a', price: 3, category: 'sides', is_available: true },
      { id: 'side-b', price: 4, category: 'sides', is_available: true },
      { id: 'side-c', price: 5, category: 'sides', is_available: true },
      { id: 'main-a', price: 10, category: 'chicken', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['main-a'] },
          { label: 'Side', min_qty: 1, max_qty: 3, item_ids: ['side-a', 'side-b', 'side-c'] },
        ],
        price: 12,
      },
    }]
    // Cart has all 3 sides available — an up-to-max engine would consume all 3.
    const cart: DealCartItem[] = [
      { menu_item_id: 'main-a', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 1 },
      { menu_item_id: 'side-b', quantity: 1 },
      { menu_item_id: 'side-c', quantity: 1 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // Correct: consumes only min_qty=1 side, the priciest one (side-c, £5).
    // 10 + 5 = 15 - 12 = 3 savings. (An up-to-max bug would consume all 3
    // sides: 10+3+4+5=22-12=10 savings — wrong.)
    expect(result.totalDiscount).toBe(3)
  })
})

describe('inSlot', () => {
  const item = { id: 'cola', category: 'Drinks' }

  it('matches on explicit item_ids', () => {
    expect(inSlot({ item_ids: ['cola'] }, item)).toBe(true)
  })

  it('matches on category when the id is not listed (case/whitespace-insensitive, like BOGO)', () => {
    expect(inSlot({ item_ids: ['other'], category: 'drinks' }, item)).toBe(true)
    expect(inSlot({ item_ids: [], category: ' DRINKS ' }, item)).toBe(true)
  })

  it('does not match when neither id nor category hits', () => {
    expect(inSlot({ item_ids: ['other'], category: 'sides' }, item)).toBe(false)
    expect(inSlot({ item_ids: ['other'] }, item)).toBe(false)
  })

  it('handles a category-only slot with empty or missing item_ids', () => {
    expect(inSlot({ item_ids: [], category: 'Drinks' }, item)).toBe(true)
    expect(inSlot({ item_ids: undefined as unknown as string[], category: 'Drinks' }, item)).toBe(true)
    expect(inSlot({ item_ids: [] }, item)).toBe(false)
  })
})

describe('bundleTotal', () => {
  it('returns cfg.price for a fixed bundle', () => {
    expect(bundleTotal({ price: 9, price_type: 'fixed' }, 20)).toBe(9)
  })

  it('treats a missing price_type as fixed (legacy configs)', () => {
    expect(bundleTotal({ price: 9 }, 20)).toBe(9)
  })

  it('applies discount_percent to the items sum for a percent bundle', () => {
    expect(bundleTotal({ price: 0, price_type: 'percent', discount_percent: 25 }, 20)).toBe(15)
  })

  it('rounds a percent bundle to 2dp', () => {
    // 10.99 * 0.85 = 9.3415 -> 9.34
    expect(bundleTotal({ price: 0, price_type: 'percent', discount_percent: 15 }, 10.99)).toBe(9.34)
  })
})

describe('matchDeals — bundle slots by category / percent pricing', () => {
  it('auto-includes items in the slot category that are not in item_ids', () => {
    const menuItems = menuMap([
      { id: 'main-a', price: 10, category: 'chicken', is_available: true },
      { id: 'drink-new', price: 3, category: 'Drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['main-a'] },
          { label: 'Drink', min_qty: 1, max_qty: 1, item_ids: [], category: 'drinks' },
        ],
        price: 10,
      },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'main-a', quantity: 1 },
      { menu_item_id: 'drink-new', quantity: 1 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // 10 + 3 = 13 - 10 = 3
    expect(result.totalDiscount).toBe(3)
  })

  it('tolerates a category-only slot with item_ids omitted entirely', () => {
    const menuItems = menuMap([{ id: 'drink-new', price: 3, category: 'drinks', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Drink Pair', is_active: true,
      config: { groups: [{ label: 'Drinks', min_qty: 2, max_qty: 2, category: 'drinks' }], price: 5 },
    }]
    const result = matchDeals([{ menu_item_id: 'drink-new', quantity: 2 }], deals, menuItems)
    expect(result.totalDiscount).toBe(1)
  })

  it('does not match a category slot when the cart item is in a different category', () => {
    const menuItems = menuMap([
      { id: 'main-a', price: 10, category: 'chicken', is_available: true },
      { id: 'side-a', price: 3, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['main-a'] },
          { label: 'Drink', min_qty: 1, max_qty: 1, item_ids: [], category: 'drinks' },
        ],
        price: 10,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'main-a', quantity: 1 }, { menu_item_id: 'side-a', quantity: 1 }]
    expect(matchDeals(cart, deals, menuItems).applied).toHaveLength(0)
  })

  it('prices a percent bundle off the picked items sum (sum 20, 25% -> savings 5)', () => {
    const menuItems = menuMap([
      { id: 'main-a', price: 15, category: 'chicken', is_available: true },
      { id: 'side-a', price: 5, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: '25% Off Combo', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['main-a'] },
          { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['side-a'] },
        ],
        price: 0,
        price_type: 'percent',
        discount_percent: 25,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'main-a', quantity: 1 }, { menu_item_id: 'side-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied[0].savings).toBe(5)
    expect(result.totalDiscount).toBe(5)
  })

  it('leaves picks beyond the last full set at full price (picker total relies on this)', () => {
    const menuItems = menuMap([
      { id: 'drink-a', price: 4, category: 'drinks', is_available: true },
      { id: 'drink-b', price: 3, category: 'drinks', is_available: true },
      { id: 'drink-c', price: 2, category: 'drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: '50% Off 2 Drinks', is_active: true,
      config: {
        groups: [{ label: 'Drinks', min_qty: 2, max_qty: 3, item_ids: ['drink-a', 'drink-b', 'drink-c'] }],
        price: 0,
        price_type: 'percent',
        discount_percent: 50,
      },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'drink-a', quantity: 1 },
      { menu_item_id: 'drink-b', quantity: 1 },
      { menu_item_id: 'drink-c', quantity: 1 },
    ]
    // One full set of 2 (the priciest: 4 + 3 = 7 -> 50% off = 3.5). The third drink can't
    // form a second set, so it stays full price — a naive "sum all picks" total would say 4.5.
    expect(matchDeals(cart, deals, menuItems).totalDiscount).toBe(3.5)
  })
})

describe('matchDeals — order_discount', () => {
  it('applies a percent-off-order discount above min_subtotal', () => {
    const menuItems = menuMap([{ id: 'item-a', price: 30, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'order_discount', name: '10% Off Orders Over £20', is_active: true,
      config: { scope: 'order', min_subtotal: 20, discount: { type: 'percent', value: 10 } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'item-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.totalDiscount).toBe(3)
  })

  it('does not apply below min_subtotal', () => {
    const menuItems = menuMap([{ id: 'item-a', price: 10, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'order_discount', name: '10% Off Orders Over £20', is_active: true,
      config: { scope: 'order', min_subtotal: 20, discount: { type: 'percent', value: 10 } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'item-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })
})

describe('matchDeals — combining deals and edge cases', () => {
  it('applies both an item deal and an order discount on the remaining subtotal', () => {
    const menuItems = menuMap([
      { id: 'wing', price: 5, category: 'chicken', is_available: true },
      { id: 'filler', price: 20, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [
      {
        id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
        config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
      },
      {
        id: 'd2', type: 'order_discount', name: '10% Off', is_active: true,
        config: { scope: 'order', discount: { type: 'percent', value: 10 } },
      },
    ]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }, { menu_item_id: 'filler', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied.map((a) => a.deal_id).sort()).toEqual(['d1', 'd2'])
    // BOGO saves 5 (one wing free). Remaining subtotal = 5 (paid wing) + 20 (filler) = 25. 10% of 25 = 2.5
    expect(result.totalDiscount).toBe(7.5)
  })

  it('ignores sold-out items entirely', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: false }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })

  it('ignores inactive deals', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: false,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })

  it('regression: same-item BOGO does not cascade with 4 identical units', () => {
    // Bug: leftover buy units from same-item BOGO were re-matched in next iteration
    // Expected: 4 wings with 1-for-1 BOGO = 2 free + 2 paid, discount = 2×5 = 10
    // Buggy behavior: 3 free + 1 paid, discount = 3×5 = 15
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 4 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0].savings).toBe(10)
    expect(result.totalDiscount).toBe(10)
  })

  it('regression: same-item BOGO with 3 identical units', () => {
    // Expected: 3 wings with 1-for-1 BOGO = 1 free + 2 paid (can only apply once), discount = 5
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 3 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0].savings).toBe(5)
    expect(result.totalDiscount).toBe(5)
  })

  it('security: an absurd cart quantity does not hang/crash and produces a bounded result', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 1000000 }]
    const result = matchDeals(cart, deals, menuItems)
    // Must return promptly (within the test's normal timeout) with sane, bounded numbers —
    // not attempt to actually allocate/process a million units.
    expect(result.applied.length).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(result.totalDiscount)).toBe(true)
    expect(result.totalDiscount).toBeLessThan(1000) // bounded, nowhere near 1,000,000 * 5 / 2
    expect(result.totalDiscount).toBeGreaterThanOrEqual(0)
  })

  it('isolates a malformed deal so other valid deals in the same call still apply', () => {
    const menuItems = menuMap([
      { id: 'wing', price: 5, category: 'chicken', is_available: true },
      { id: 'fries', price: 3, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [
      {
        // Malformed: get.discount is missing entirely, which would throw when
        // priceAfterDiscount tries to read `.percent` off undefined.
        id: 'bad', type: 'bogo', name: 'Broken Deal', is_active: true,
        config: { buy: { item_ids: ['fries'], qty: 1 }, get: { item_ids: ['fries'], qty: 1 } },
      },
      {
        id: 'good', type: 'bogo', name: 'BOGO Wings', is_active: true,
        config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
      },
    ]
    const cart: DealCartItem[] = [
      { menu_item_id: 'wing', quantity: 2 },
      { menu_item_id: 'fries', quantity: 2 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied.map((a) => a.deal_id)).toEqual(['good'])
    expect(result.totalDiscount).toBe(5)
  })
})

describe('isDealLive', () => {
  it('is live when is_active and no schedule window is set', () => {
    expect(isDealLive({ is_active: true, available_from: null, available_until: null })).toBe(true)
  })

  it('is not live when is_active is false, regardless of schedule', () => {
    expect(isDealLive({ is_active: false, available_from: null, available_until: null })).toBe(false)
  })

  it('is live when now is within the schedule window', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: '2026-06-01T00:00:00Z',
      available_until: '2026-06-30T23:59:59Z',
    }, now)).toBe(true)
  })

  it('is not live before available_from', () => {
    const now = new Date('2026-05-01T00:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: '2026-06-01T00:00:00Z',
      available_until: null,
    }, now)).toBe(false)
  })

  it('is not live after available_until', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: null,
      available_until: '2026-06-30T23:59:59Z',
    }, now)).toBe(false)
  })
})
