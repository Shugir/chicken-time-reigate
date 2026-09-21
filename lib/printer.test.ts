import { describe, it, expect } from 'vitest'
import { generateReceiptBuffer } from './printer'

const baseOrder = {
  id: 'abcdef123456',
  created_at: '2026-09-21T12:30:00Z',
  order_type: 'delivery',
  customer_name: 'Sam',
  customer_phone: '07000000000',
  total_amount: 20,
}

const custom = {
  item_name: 'Zinger Burger',
  quantity: 2,
  unit_price: 10,
  spicy_level: 'Hot',
  removals: ['Lettuce'],
  additions: ['Extra cheese'],
  extras: [
    { name: 'Coke', price: 1.5, qty: 2 },
    { name: 'Mayo', price: 0.5 },
  ],
}

const render = (items: unknown[], extra: Record<string, unknown> = {}) =>
  generateReceiptBuffer({ ...baseOrder, order_items: items, ...extra }, 'Dave').toString('latin1')

describe('generateReceiptBuffer', () => {
  it('prints the spicy level, removals and additions', () => {
    const text = render([custom])
    expect(text).toContain('  Spicy: Hot\n')
    expect(text).toContain('  - No Lettuce\n')
    expect(text).toContain('  + Extra cheese\n')
  })

  it('prints extras with quantity and the qty-multiplied price, right-aligned', () => {
    const text = render([custom])
    const coke = text.split('\n').find((l) => l.includes('Coke'))!
    expect(coke.startsWith('  + Coke \xd7' + '2')).toBe(true)
    expect(coke.endsWith('\xa33.00')).toBe(true)
    expect(coke.length).toBe(48)
    // missing qty counts as 1: no multiplier shown, plain price
    const mayo = text.split('\n').find((l) => l.includes('Mayo'))!
    expect(mayo).not.toContain('\xd7')
    expect(mayo.endsWith('\xa30.50')).toBe(true)
  })

  it('prints modifiers in order: spicy, removals, additions, extras', () => {
    const text = render([custom])
    const at = (s: string) => text.indexOf(s)
    const order = [at('2x Zinger Burger'), at('Spicy: Hot'), at('- No Lettuce'), at('+ Extra cheese'), at('+ Coke'), at('+ Mayo')]
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('uses unit_price x quantity for the line total and subtotal', () => {
    const text = render([custom])
    const line = text.split('\n').find((l) => l.includes('2x Zinger Burger'))!
    expect(line.endsWith('\xa320.00')).toBe(true)
    expect(text).toMatch(/Subtotal\s+\xa320\.00/)
  })

  it('still prints a legacy item with no spicy_level, additions or qty', () => {
    const legacy = {
      item_name: 'Wings',
      quantity: 1,
      unit_price: 6,
      removals: ['Skin'],
      extras: [{ name: 'BBQ dip', price: 0.75 }],
    }
    const text = render([legacy], { total_amount: 6 })
    expect(text).toContain('1x Wings')
    expect(text).toContain('  - No Skin\n')
    expect(text).toContain('  + BBQ dip')
    expect(text).not.toContain('Spicy')
    expect(text).not.toContain('\xd7')
  })

  it('handles an item with none of the modifier fields at all', () => {
    const bare = { item_name: null, quantity: 3, unit_price: 2 }
    const text = render([bare], { total_amount: 6, order_type: 'pickup' })
    expect(text).toContain('3x Item')
    expect(text).toContain('*** COLLECTION ***')
  })

  it('handles null modifier columns from the database', () => {
    const nulls = { item_name: 'Fries', quantity: 1, unit_price: 3, spicy_level: null, removals: null, additions: null, extras: null }
    expect(() => render([nulls], { total_amount: 3 })).not.toThrow()
  })
})
