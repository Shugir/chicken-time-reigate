import { describe, it, expect } from 'vitest'
import { formatCsvItem, toCsv } from './csv'
import type { AdminReceiptOrder, OrderItem } from '@/components/admin/receipts/types'

const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  id: 'i1', item_name: 'Nashville', quantity: 2, unit_price: 5,
  extras: [], removals: [], notes: null, ...over,
})

const order = (items: OrderItem[]): AdminReceiptOrder => ({
  id: 'abcdef123456', created_at: '2026-09-21T12:00:00Z', order_type: 'delivery',
  customer_name: null, customer_email: null, customer_phone: null, customer_notes: null,
  delivery_address: null, delivery_postcode: null, total_amount: 10, status: 'paid',
  delivery_status: null, promo_code_used: null, discount_applied: 0, applied_deals: null,
  driver_id: null, driver_name: null, stripe_session_id: null, order_items: items,
})

describe('formatCsvItem', () => {
  it('leaves items without modifiers as before', () => {
    expect(formatCsvItem(item())).toBe('Nashville ×2')
  })

  it('lists spicy, removals, additions, extras in order (extra qty defaults to 1)', () => {
    const i = item({
      spicy_level: 'Hot',
      removals: ['Pickles'],
      additions: ['Cheese'],
      extras: [{ name: 'Coke', price: 1, qty: 2 }, { name: 'Dip', price: 0.5 }],
    })
    expect(formatCsvItem(i)).toBe('Nashville ×2 (Spicy: Hot; NO Pickles; + Cheese; + Coke ×2; + Dip)')
  })

  it('tolerates null additions', () => {
    expect(formatCsvItem(item({ additions: null, spicy_level: null }))).toBe('Nashville ×2')
  })
})

describe('toCsv', () => {
  it('keeps modifiers with commas and quotes valid CSV', () => {
    const csv = toCsv([order([item({ removals: ['Onion, red', 'the "hot" sauce'] })])])
    expect(csv.split('\n')[1]).toContain('"Nashville ×2 (NO Onion, red; NO the ""hot"" sauce)"')
  })
})
