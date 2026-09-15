import { describe, it, expect } from 'vitest'
import { matchDeals, type Deal, type MenuItemLite, type DealCartItem } from './deal-engine'

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

describe('matchDeals — bundle', () => {
  it('consumes the highest-priced qualifying item per group', () => {
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
          { label: 'Main', category: 'chicken', pick_qty: 1 },
          { label: 'Side', category: 'sides', pick_qty: 1 },
          { label: 'Drink', category: 'drinks', pick_qty: 1 },
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
    // Picks chicken-b (£8, the pricier main) into the bundle: 8+2+1.5=11.5 - 9 = 2.5 savings
    expect(result.totalDiscount).toBe(2.5)
  })

  it('does not apply when a group has too few qualifying items', () => {
    const menuItems = menuMap([{ id: 'chicken-a', price: 6, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', category: 'chicken', pick_qty: 1 },
          { label: 'Side', category: 'sides', pick_qty: 1 },
        ],
        price: 5,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'chicken-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })
})

describe('matchDeals — fixed_meal', () => {
  it('applies when every required item/qty is present', () => {
    const menuItems = menuMap([
      { id: 'whole-chicken', price: 12, category: 'chicken', is_available: true },
      { id: 'side-a', price: 2, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'fixed_meal', name: 'Family Feast', is_active: true,
      config: { items: [{ item_id: 'whole-chicken', qty: 1 }, { item_id: 'side-a', qty: 2 }], price: 13 },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'whole-chicken', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 2 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // 12 + 2*2 = 16 - 13 = 3
    expect(result.totalDiscount).toBe(3)
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
})
