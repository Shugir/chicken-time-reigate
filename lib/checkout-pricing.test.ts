import { describe, it, expect } from 'vitest'
import { priceCartLines, deliveryFeeFor, repriceLine, type PricingMenuRow } from './checkout-pricing'

const wings: PricingMenuRow = {
  id: 'wings', name: 'Wings', price: 10,
  add_ons: [{ name: 'Bacon', price: 1.5 }],
  drinks_regular: [{ name: 'Coke', price: 1.2 }],
  dips: [{ name: 'Mayo', price: 0 }],
  extras: [{ name: 'Legacy Cheese', price: 0.5 }],
}
const menu = new Map<string, PricingMenuRow>([['wings', wings]])

const line = (over: Record<string, unknown> = {}) => ({
  menu_item_id: 'wings', name: 'Wings', price: 10, quantity: 2, totalPrice: 20, extras: [], removals: [], ...over,
})

describe('priceCartLines', () => {
  it('prices from the database, ignoring nothing the client got right', () => {
    const r = priceCartLines([line()], menu)
    expect(r).toMatchObject({ ok: true, subtotal: 20 })
    if (r.ok) expect(r.lines[0]).toMatchObject({ name: 'Wings', price: 10, quantity: 2, totalPrice: 20 })
  })

  it('prices extras from the DB with quantity', () => {
    const r = priceCartLines([line({
      price: 13.9, totalPrice: 27.8,
      extras: [
        { name: 'Coke', price: 1.2, qty: 2, category: 'drinks_regular' },
        { name: 'Bacon', price: 1.5, category: 'add_ons' },
      ],
    })], menu)
    // 10 + 1.2*2 + 1.5 = 13.9 per unit, x2
    expect(r).toMatchObject({ ok: true, subtotal: 27.8 })
  })

  it('accepts a legacy extra without a category', () => {
    const r = priceCartLines([line({ price: 10.5, totalPrice: 21, extras: [{ name: 'Legacy Cheese', price: 0.5 }] })], menu)
    expect(r).toMatchObject({ ok: true, subtotal: 21 })
  })

  it('rejects a tampered unit price', () => {
    const r = priceCartLines([line({ price: 0.01, totalPrice: 0.02 })], menu)
    expect(r).toEqual({ ok: false, error: 'Prices have changed since you added Wings. Please review your cart.' })
  })

  it('rejects a tampered extra price', () => {
    const r = priceCartLines([line({ price: 10, extras: [{ name: 'Bacon', price: 0, category: 'add_ons' }] })], menu)
    expect(r.ok).toBe(false)
  })

  it('rejects an extra the item does not offer', () => {
    const r = priceCartLines([line({ extras: [{ name: 'Truffle', price: 0, category: 'add_ons' }] })], menu)
    expect(r).toEqual({ ok: false, error: 'Sorry, Truffle is not available on Wings. Please update your order.' })
  })

  it('does not accept an extra under the wrong category', () => {
    const r = priceCartLines([line({ extras: [{ name: 'Coke', price: 1.2, category: 'dips' }] })], menu)
    expect(r.ok).toBe(false)
  })

  it('requires a menu item that exists', () => {
    expect(priceCartLines([line({ menu_item_id: undefined })], menu).ok).toBe(false)
    expect(priceCartLines([line({ menu_item_id: 'gone' })], menu).ok).toBe(false)
  })

  it.each([0, -1, 1.5, 100, NaN])('rejects quantity %s', (quantity) => {
    expect(priceCartLines([line({ quantity })], menu).ok).toBe(false)
  })

  it.each([0, -2, 1.5, 100])('rejects extra qty %s', (qty) => {
    const r = priceCartLines([line({ extras: [{ name: 'Mayo', price: 0, qty, category: 'dips' }] })], menu)
    expect(r.ok).toBe(false)
  })

  it('rejects an empty cart', () => {
    expect(priceCartLines([], menu).ok).toBe(false)
  })
})

describe('priceCartLines - spicy level', () => {
  const spicyMenu = new Map<string, PricingMenuRow>([['wings', { ...wings, spicy_levels: ['Mild', 'Hot'] }]])

  it('accepts a spicy level the item offers and keeps it on the line', () => {
    const r = priceCartLines([line({ spicy_level: 'Hot' })], spicyMenu)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lines[0]).toMatchObject({ spicy_level: 'Hot' })
  })

  it('accepts a line with no spicy level', () => {
    expect(priceCartLines([line()], spicyMenu).ok).toBe(true)
    expect(priceCartLines([line({ spicy_level: '' })], spicyMenu).ok).toBe(true)
    expect(priceCartLines([line({ spicy_level: null })], spicyMenu).ok).toBe(true)
  })

  it('rejects a spicy level the item does not offer', () => {
    expect(priceCartLines([line({ spicy_level: 'Nuclear' })], spicyMenu)).toEqual({
      ok: false, error: 'Sorry, Nuclear is not available on Wings. Please update your order.',
    })
  })

  it('rejects any spicy level on an item that offers none', () => {
    expect(priceCartLines([line({ spicy_level: 'Hot' })], menu).ok).toBe(false)
  })

  it('rejects a spicy level that is not a string', () => {
    expect(priceCartLines([line({ spicy_level: 5 })], spicyMenu).ok).toBe(false)
  })
})

describe('deliveryFeeFor', () => {
  const zones = [
    { postcode_prefix: 'SW', delivery_fee: 2.5, free_delivery_threshold: 30 },
    { postcode_prefix: 'E1', delivery_fee: '3.00', free_delivery_threshold: null },
  ]

  it('is free for pickup, whatever the postcode', () => {
    expect(deliveryFeeFor({ orderType: 'pickup', postcode: undefined, zones, subtotal: 5 })).toEqual({ ok: true, fee: 0 })
  })

  it('uses the matching zone fee, case and space insensitive', () => {
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: ' sw1a 1aa', zones, subtotal: 10 })).toEqual({ ok: true, fee: 2.5 })
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: 'E1 6AN', zones, subtotal: 10 })).toEqual({ ok: true, fee: 3 })
  })

  it('waives the fee at the free-delivery threshold', () => {
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: 'SW1A 1AA', zones, subtotal: 30 })).toEqual({ ok: true, fee: 0 })
  })

  it('rejects a delivery below the zone minimum order, with the client message', () => {
    const minZones = [{ postcode_prefix: 'RH4', delivery_fee: 2.49, min_order_amount: 10 }]
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: 'RH4 1AA', zones: minZones, subtotal: 9.5 })).toEqual({
      ok: false, error: 'Minimum order £10.00 for your area (you have £9.50).',
    })
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: 'RH4 1AA', zones: minZones, subtotal: 10 })).toEqual({ ok: true, fee: 2.49 })
  })

  it('does not apply the minimum order to pickup', () => {
    const minZones = [{ postcode_prefix: 'RH4', delivery_fee: 2.49, min_order_amount: '10.00' }]
    expect(deliveryFeeFor({ orderType: 'pickup', postcode: 'RH4 1AA', zones: minZones, subtotal: 2 })).toEqual({ ok: true, fee: 0 })
  })

  it('rejects a delivery with no matching zone', () => {
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: 'ZZ9 9ZZ', zones, subtotal: 10 }).ok).toBe(false)
    expect(deliveryFeeFor({ orderType: 'delivery', postcode: undefined, zones, subtotal: 10 }).ok).toBe(false)
  })
})

describe('repriceLine - spicy level', () => {
  it('keeps a spicy level the item still offers and drops one it no longer does', () => {
    const row: PricingMenuRow = { ...wings, spicy_levels: ['Hot'] }
    expect(repriceLine({ quantity: 1, spicy_level: 'Hot' }, row).spicy_level).toBe('Hot')
    expect(repriceLine({ quantity: 1, spicy_level: 'Mild' }, row).spicy_level).toBeUndefined()
    expect(repriceLine({ quantity: 1 }, row).spicy_level).toBeUndefined()
  })
})

describe('repriceLine', () => {
  it('uses the current price and drops extras that are gone or sold out', () => {
    const row: PricingMenuRow = { ...wings, price: 11, sold_out_extras: ['Coke'] }
    const r = repriceLine({
      quantity: 2,
      extras: [
        { name: 'Bacon', price: 1, category: 'add_ons' },
        { name: 'Coke', price: 1.2, category: 'drinks_regular' },
        { name: 'Truffle', price: 0, category: 'add_ons' },
      ],
    }, row)
    expect(r.extras).toEqual([{ name: 'Bacon', price: 1.5, category: 'add_ons' }])
    expect(r).toMatchObject({ name: 'Wings', price: 12.5, totalPrice: 25 })
  })
})
