import { describe, it, expect } from 'vitest'
import { loadCart, saveCart, queueCartLine, CART_KEY, PENDING_KEY } from './use-cart'
import type { CartEntryLike } from './cart-lines'

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    has: (k: string) => m.has(k),
  }
}

const plain = (qty: number): CartEntryLike => ({ qty, removals: [], additions: [], extras: [] })

describe('persisted cart', () => {
  it('empty storage loads as an empty cart', () => {
    expect(loadCart(fakeStorage())).toEqual({})
  })

  it('survives a remount: save then load returns the same cart', () => {
    const s = fakeStorage()
    saveCart(s, { b1: plain(2) })
    expect(loadCart(s)).toEqual({ b1: plain(2) })
  })

  it('corrupt JSON loads as empty', () => {
    expect(loadCart(fakeStorage({ [CART_KEY]: '{not json' }))).toEqual({})
  })

  it('merges queued lines into the saved cart, summing identical lines, and clears the queue', () => {
    const s = fakeStorage({
      [CART_KEY]: JSON.stringify({ b1: plain(1) }),
      [PENDING_KEY]: JSON.stringify({ b1: plain(2), w1: plain(1) }),
    })
    expect(loadCart(s)).toEqual({ b1: plain(3), w1: plain(1) })
    expect(s.has(PENDING_KEY)).toBe(false)
  })

  it('loading twice keeps queued lines (StrictMode runs mount effects twice)', () => {
    const s = fakeStorage({ [PENDING_KEY]: JSON.stringify({ w1: plain(1) }) })
    loadCart(s)
    expect(loadCart(s)).toEqual({ w1: plain(1) })
  })

  it('queueCartLine adds a line and merges identical options', () => {
    const s = fakeStorage()
    const opts = { spicy_level: 'Hot', removals: [], additions: [], extras: [] }
    queueCartLine(s, 'b1', opts, 1)
    queueCartLine(s, 'b1', opts, 2)
    const cart = loadCart(s)
    expect(Object.values(cart)).toHaveLength(1)
    expect(Object.values(cart)[0].qty).toBe(3)
  })

  it('blocked storage (every call throws) loads empty and queueing does not throw', () => {
    const boom = () => { throw new Error('SecurityError') }
    const s = { getItem: boom, setItem: boom, removeItem: boom }
    expect(loadCart(s)).toEqual({})
    expect(() => queueCartLine(s, 'b1', { removals: [], additions: [], extras: [] }, 1)).not.toThrow()
  })
})
