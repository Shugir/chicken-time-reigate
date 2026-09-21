import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CustomerReceipt, type ReceiptOrder } from './CustomerReceipt'

const baseOrder = {
  id: 'abcdef123456',
  created_at: '2026-09-21T12:30:00Z',
  order_type: 'delivery',
  customer_name: 'Sam',
  customer_phone: '07000000000',
  delivery_address: '1 High St',
  delivery_postcode: 'rh2 0aa',
  customer_notes: null,
  total_amount: 20,
}

const render = (order_items: ReceiptOrder['order_items'], extra: Partial<ReceiptOrder> = {}) =>
  renderToStaticMarkup(createElement(CustomerReceipt, { order: { ...baseOrder, order_items, ...extra } }))

describe('CustomerReceipt', () => {
  it('renders spicy level, removals, additions and extras with qty and multiplied price', () => {
    const html = render([{
      id: 'i1', item_name: 'Zinger Burger', quantity: 2, unit_price: 10, notes: null,
      spicy_level: 'Hot',
      removals: ['Lettuce'],
      additions: ['Extra cheese'],
      extras: [{ name: 'Coke', price: 1.5, qty: 2 }, { name: 'Mayo', price: 0.5 }],
    }])
    expect(html).toContain('Spicy: Hot')
    expect(html).toContain('- No Lettuce')
    expect(html).toContain('+ Extra cheese')
    expect(html).toContain('+ Coke ×2')
    expect(html).toContain('£3.00') // 1.5 x 2
    expect(html).toContain('+ Mayo')
    expect(html).not.toContain('Mayo ×')
    expect(html).toContain('£0.50')
    expect(html).toContain('£20.00') // line total: unit_price x quantity
  })

  it('renders modifiers in order: spicy, removals, additions, extras', () => {
    const html = render([{
      id: 'i1', item_name: 'Zinger Burger', quantity: 1, unit_price: 10, notes: null,
      spicy_level: 'Hot', removals: ['Lettuce'], additions: ['Extra cheese'],
      extras: [{ name: 'Coke', price: 1.5, qty: 2 }],
    }])
    const idx = ['Spicy: Hot', '- No Lettuce', '+ Extra cheese', '+ Coke'].map((s) => html.indexOf(s))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })

  it('renders a legacy item (no spicy_level, additions or qty) unchanged', () => {
    const html = render([{
      id: 'i1', item_name: 'Wings', quantity: 1, unit_price: 6, notes: null,
      removals: ['Skin'],
      extras: [{ name: 'BBQ dip', price: 0.75 }],
    }], { total_amount: 6 })
    expect(html).toContain('1x Wings')
    expect(html).toContain('- No Skin')
    expect(html).toContain('+ BBQ dip')
    expect(html).toContain('£0.75')
    expect(html).not.toContain('Spicy')
    expect(html).not.toContain('×')
  })

  it('tolerates null modifier columns', () => {
    const html = render([{
      id: 'i1', item_name: 'Fries', quantity: 1, unit_price: 3, notes: null,
      spicy_level: null, additions: null,
      removals: null as unknown as string[], extras: null as unknown as [],
    }], { total_amount: 3 })
    expect(html).toContain('1x Fries')
  })
})
