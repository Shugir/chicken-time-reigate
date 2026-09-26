import { describe, it, expect } from 'vitest'
import { bogoLabel, bogosFor, bundlesContaining, cardDealLabel, dealPriceLabel, lockedSlotIndex, slotItems, type BundleDeal } from './deal-page'

const burger = { id: 'b1', category: 'burgers', is_available: true }
const wrap = { id: 'w1', category: 'wraps', is_available: true }
const fries = { id: 'f1', category: 'sides', is_available: true }
const cola = { id: 'c1', category: 'drinks', is_available: true }
const soldOutCola = { id: 'c2', category: 'drinks', is_available: false }
const items = [burger, wrap, fries, cola, soldOutCola]

const burgerMeal: BundleDeal = {
  id: 'd1', type: 'bundle', name: 'Burger Meal',
  config: {
    price: 9.99,
    groups: [
      { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['b1', 'w1'] },
      { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['f1'] },
      // category-based slot, no item_ids
      { label: 'Drink', min_qty: 1, max_qty: 2, category: 'Drinks' },
    ],
  },
}
const bigMeal: BundleDeal = {
  id: 'd2', type: 'bundle', name: 'Big Meal',
  config: { price: 12.5, groups: [{ label: 'Burger', min_qty: 2, max_qty: 2, category: 'burgers' }] },
}
const percentMeal: BundleDeal = {
  id: 'd3', type: 'bundle', name: 'Drinks Deal',
  config: { price: 0, price_type: 'percent', discount_percent: 20, groups: [{ label: 'Drink', min_qty: 2, max_qty: 2, category: 'drinks' }] },
}
const bogo = { id: 'd4', type: 'bogo', name: 'BOGO', config: { buy: { qty: 1, category: 'burgers' } } }

describe('bundlesContaining', () => {
  const deals = [burgerMeal, bigMeal, percentMeal, bogo]
  it('finds no deals for an item in none', () => {
    expect(bundlesContaining(deals, { id: 'x', category: 'desserts' })).toEqual([])
  })
  it('finds the one deal an item is in', () => {
    expect(bundlesContaining(deals, fries).map((d) => d.id)).toEqual(['d1'])
  })
  it('finds every bundle an item is in, by item_ids or category, ignoring non-bundles', () => {
    expect(bundlesContaining(deals, burger).map((d) => d.id)).toEqual(['d1', 'd2'])
  })
})

describe('lockedSlotIndex', () => {
  it('is the first slot that holds the item', () => {
    expect(lockedSlotIndex(burgerMeal, burger)).toBe(0)
    expect(lockedSlotIndex(burgerMeal, cola)).toBe(2)
  })
  it('is -1 when the deal does not hold the item', () => {
    expect(lockedSlotIndex(bigMeal, fries)).toBe(-1)
  })
})

describe('slotItems', () => {
  it('lists available items in an item_ids slot', () => {
    expect(slotItems(burgerMeal, 0, items).map((i) => i.id)).toEqual(['b1', 'w1'])
  })
  it('lists available items in a category slot, case-insensitively, without sold-out items', () => {
    expect(slotItems(burgerMeal, 2, items).map((i) => i.id)).toEqual(['c1'])
  })
  it('lists only the locked item in its slot', () => {
    expect(slotItems(burgerMeal, 0, items, burger).map((i) => i.id)).toEqual(['b1'])
  })
  it('leaves the other slots alone when an item is locked', () => {
    expect(slotItems(burgerMeal, 1, items, burger).map((i) => i.id)).toEqual(['f1'])
  })
})

describe('dealPriceLabel', () => {
  it('shows a fixed price', () => {
    expect(dealPriceLabel(burgerMeal.config)).toBe('£9.99')
  })
  it('shows a percent discount', () => {
    expect(dealPriceLabel(percentMeal.config)).toBe('20% off')
  })
})

describe('cardDealLabel', () => {
  it('is null with no deals', () => {
    expect(cardDealLabel([])).toBeNull()
  })
  it('is the deal price with one deal', () => {
    expect(cardDealLabel([bigMeal])).toBe('£12.50')
    expect(cardDealLabel([percentMeal])).toBe('20% off')
  })
  it('is "from" the lowest fixed price with several fixed deals', () => {
    expect(cardDealLabel([bigMeal, burgerMeal])).toBe('from £9.99')
  })
  it('keeps the first deal label when fewer than two deals are fixed-price', () => {
    expect(cardDealLabel([percentMeal, bigMeal])).toBe('20% off')
  })
})

describe('bogosFor / bogoLabel', () => {
  const bogo = (buy: object, get: object) => ({ id: 'b', type: 'bogo', name: 'BOGO', config: { buy, get } })
  const burger = { id: 'burger', category: 'burgers' }

  it('finds BOGO deals whose Buy side includes the item, by id or category', () => {
    const deals = [
      bogo({ qty: 1, item_ids: ['burger'] }, { qty: 1, discount: { percent: 50 }, item_ids: ['burger'] }),
      bogo({ qty: 1, category: 'Burgers' }, { qty: 1, discount: 'free', category: 'drinks' }),
      bogo({ qty: 1, item_ids: ['wings'] }, { qty: 1, discount: 'free', item_ids: ['burger'] }),
      { id: 'x', type: 'bundle', name: 'Meal', config: { groups: [] } },
    ]
    expect(bogosFor(deals, burger).map((d) => d.config.get.discount)).toEqual([{ percent: 50 }, 'free'])
  })

  it('labels half price, free and other percentages', () => {
    expect(bogoLabel({ buy: { qty: 1 }, get: { qty: 1, discount: { percent: 50 } } })).toBe('Buy 1, get 1 half price')
    expect(bogoLabel({ buy: { qty: 2 }, get: { qty: 1, discount: 'free' } })).toBe('Buy 2, get 1 free')
    expect(bogoLabel({ buy: { qty: 1 }, get: { qty: 2, discount: { percent: 30 } } })).toBe('Buy 1, get 2 at 30% off')
  })
})
