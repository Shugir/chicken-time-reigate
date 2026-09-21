import { describe, it, expect } from 'vitest'
import { slotQty, isSelectionComplete, upgradesTotal } from './deal-slot-picker-logic'

describe('slotQty', () => {
  it('sums qty across picks', () => {
    expect(slotQty([{ item_id: 'a', qty: 2 }, { item_id: 'b', qty: 1 }])).toBe(3)
  })
  it('is 0 for no picks', () => {
    expect(slotQty([])).toBe(0)
  })
})

describe('isSelectionComplete', () => {
  it('is false when a required slot is under min_qty', () => {
    const groups = [{ min_qty: 1, max_qty: 1 }, { min_qty: 1, max_qty: 2 }]
    const picks = { 0: [{ item_id: 'a', qty: 1 }], 1: [] }
    expect(isSelectionComplete(groups, picks)).toBe(false)
  })
  it('is true when every slot is within [min_qty, max_qty]', () => {
    const groups = [{ min_qty: 1, max_qty: 1 }, { min_qty: 1, max_qty: 2 }]
    const picks = { 0: [{ item_id: 'a', qty: 1 }], 1: [{ item_id: 'b', qty: 2 }] }
    expect(isSelectionComplete(groups, picks)).toBe(true)
  })
  it('is false when a slot exceeds max_qty', () => {
    const groups = [{ min_qty: 1, max_qty: 1 }]
    const picks = { 0: [{ item_id: 'a', qty: 2 }] }
    expect(isSelectionComplete(groups, picks)).toBe(false)
  })
  it('treats a missing group entry as zero picks (e.g. an optional min_qty: 0 slot nobody touched)', () => {
    const groups = [{ min_qty: 0, max_qty: 1 }]
    expect(isSelectionComplete(groups, {})).toBe(true)
  })
})

describe('upgradesTotal', () => {
  it('sums price times qty and rounds to 2dp', () => {
    expect(upgradesTotal([{ price: 1.1, qty: 3 }, { price: 0.5, qty: 1 }])).toBe(3.8)
  })
  it('is 0 for no upgrades', () => {
    expect(upgradesTotal([])).toBe(0)
  })
})
