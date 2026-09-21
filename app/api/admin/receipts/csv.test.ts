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

  it.each(['=', '+', '-', '@'])('prefixes a single quote when a cell starts with %s', (c) => {
    const row = toCsv([{ ...order([item()]), customer_name: `${c}cmd|calc` }]).split('\n')[1]
    expect(row).toContain(`"'${c}cmd|calc"`)
  })

  it.each(['=', '+', '-', '@'])('prefixes a single quote when an item name starts with %s', (c) => {
    const row = toCsv([order([item({ item_name: `${c}SUM(1)` })])]).split('\n')[1]
    expect(row).toContain(`"'${c}SUM(1) ×2"`)
  })

  it('prefixes a single quote before escaping quotes', () => {
    const row = toCsv([{ ...order([item()]), customer_name: '=HYPERLINK("x")' }]).split('\n')[1]
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('neutralises tab and carriage-return starts', () => {
    const row = toCsv([{ ...order([item()]), customer_name: '\tx', customer_email: '\ry' }]).split('\n')[1]
    expect(row).toContain(`"'\tx"`)
    expect(row).toContain(`"'\ry"`)
  })

  it('leaves a normal name unchanged', () => {
    expect(toCsv([{ ...order([item()]), customer_name: 'Jane Doe' }]).split('\n')[1]).toContain('"Jane Doe"')
  })

  it('leaves numeric money cells as numbers', () => {
    const row = toCsv([{ ...order([item()]), discount_applied: 0, total_amount: 10 }]).split('\n')[1]
    expect(row).toContain('"10.00","0.00","10.00"')
  })

  it('leaves negative numeric strings alone', () => {
    const row = toCsv([{ ...order([item()]), discount_applied: -2.5 }]).split('\n')[1]
    expect(row).toContain('"-2.50"')
  })
})
