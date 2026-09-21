import { describe, it, expect } from 'vitest'
import { lineKey, itemIdOfKey, addToLines, changeLineQty, itemQty, removeOneFromItem, type CartEntryLike } from './cart-lines'

const plain = (qty: number): CartEntryLike => ({ qty, removals: [], additions: [], extras: [] })
const hot = (qty: number): CartEntryLike => ({ qty, spicy_level: 'Hot', removals: [], additions: [], extras: [] })

describe('lineKey', () => {
  it('is the bare item id when there are no options', () => {
    expect(lineKey('a')).toBe('a')
    expect(lineKey('a', { removals: [], additions: [], extras: [], notes: '  ' })).toBe('a')
  })

  it('ignores the order of removals, additions and extras', () => {
    const one = lineKey('a', { removals: ['x', 'y'], extras: [{ name: 'Coke', price: 1, qty: 2, category: 'drinks_regular' }, { name: 'Bacon', price: 1, category: 'add_ons' }] })
    const two = lineKey('a', { removals: ['y', 'x'], extras: [{ name: 'Bacon', price: 1, category: 'add_ons' }, { name: 'Coke', price: 1, qty: 2, category: 'drinks_regular' }] })
    expect(one).toBe(two)
  })

  it('differs when any option differs', () => {
    const base = lineKey('a', { spicy_level: 'Hot' })
    expect(lineKey('a', { spicy_level: 'Mild' })).not.toBe(base)
    expect(lineKey('a', { spicy_level: 'Hot', removals: ['x'] })).not.toBe(base)
    expect(lineKey('a', { spicy_level: 'Hot', notes: 'well done' })).not.toBe(base)
    expect(lineKey('a', { extras: [{ name: 'Coke', price: 1, qty: 1 }] })).not.toBe(lineKey('a', { extras: [{ name: 'Coke', price: 1, qty: 2 }] }))
  })

  it('treats a missing extra qty as 1 and ignores price', () => {
    expect(lineKey('a', { extras: [{ name: 'Coke', price: 1 }] })).toBe(lineKey('a', { extras: [{ name: 'Coke', price: 9, qty: 1 }] }))
  })
})

describe('itemIdOfKey', () => {
  it('returns the item id for plain and option keys', () => {
    expect(itemIdOfKey('abc')).toBe('abc')
    expect(itemIdOfKey(lineKey('abc', { spicy_level: 'Hot' }))).toBe('abc')
  })
})

describe('addToLines', () => {
  it('sums quantity for identical options', () => {
    let cart = addToLines({}, 'a', hot(0), 1)
    cart = addToLines(cart, 'a', hot(0), 2)
    expect(Object.values(cart)).toEqual([expect.objectContaining({ qty: 3, spicy_level: 'Hot' })])
  })

  it('keeps different options as separate lines', () => {
    let cart = addToLines({}, 'a', hot(0), 1)
    cart = addToLines(cart, 'a', { ...hot(0), spicy_level: 'Mild' }, 1)
    cart = addToLines(cart, 'a', plain(0), 1)
    expect(Object.keys(cart)).toHaveLength(3)
    expect(itemQty(cart, 'a')).toBe(3)
  })
})

describe('changeLineQty', () => {
  it('changes a line and removes it at zero', () => {
    const cart = addToLines({}, 'a', plain(0), 2)
    expect(changeLineQty(cart, 'a', -1).a.qty).toBe(1)
    expect(changeLineQty(cart, 'a', -2)).toEqual({})
  })

  it('leaves the cart alone for an unknown key', () => {
    const cart = addToLines({}, 'a', plain(0), 1)
    expect(changeLineQty(cart, 'zzz', 1)).toBe(cart)
  })
})

describe('itemQty and removeOneFromItem', () => {
  it('counts across every line of the item only', () => {
    let cart = addToLines({}, 'a', plain(0), 2)
    cart = addToLines(cart, 'a', hot(0), 1)
    cart = addToLines(cart, 'b', plain(0), 5)
    expect(itemQty(cart, 'a')).toBe(3)
  })

  it('takes one from the plain line first, then the latest customized line', () => {
    let cart = addToLines({}, 'a', hot(0), 1)
    cart = addToLines(cart, 'a', plain(0), 1)
    cart = removeOneFromItem(cart, 'a')
    expect(Object.keys(cart)).toEqual([lineKey('a', { spicy_level: 'Hot' })])
    cart = removeOneFromItem(cart, 'a')
    expect(cart).toEqual({})
  })
})
