'use client'

import { useEffect, useState } from 'react'
import { addToLines, type CartEntryLike, type LineOptions } from './cart-lines'

export const CART_KEY = 'cart'
/** Lines queued by other pages (/deals, /order/customize) for /order to merge on load. */
export const PENDING_KEY = 'pendingCartEntries'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function readJson<T>(storage: StorageLike, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveCart(storage: StorageLike, cart: Record<string, CartEntryLike>): void {
  try {
    storage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    // quota or disabled storage: the cart still works in memory
  }
}

/** Saved cart plus any queued lines. Consumes the queue and saves the merge first, so a second load sees it. */
export function loadCart<E extends CartEntryLike>(storage: StorageLike): Record<string, E> {
  const cart: Record<string, E> = { ...(readJson<Record<string, E>>(storage, CART_KEY) ?? {}) }
  const pending = readJson<Record<string, E>>(storage, PENDING_KEY)
  if (pending) {
    for (const [key, entry] of Object.entries(pending)) {
      cart[key] = cart[key] ? { ...cart[key], qty: cart[key].qty + entry.qty } : entry
    }
    saveCart(storage, cart)
    try {
      storage.removeItem(PENDING_KEY)
    } catch {
      // blocked storage: nothing to clear
    }
  }
  return cart
}

/** Queue one line for /order to pick up on its next load. */
export function queueCartLine(storage: StorageLike, itemId: string, entry: LineOptions, qty: number): void {
  const pending = readJson<Record<string, CartEntryLike>>(storage, PENDING_KEY) ?? {}
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(addToLines(pending, itemId, entry, qty)))
  } catch {
    // blocked or full storage: the line can't be queued
  }
}

/**
 * Cart state persisted to sessionStorage. It starts empty and loads after mount, so the
 * server render and the first client render match (no hydration mismatch). Saving waits
 * for that load, so the empty first render never overwrites the stored cart.
 */
export function useCart<E extends CartEntryLike>() {
  const [cart, setCart] = useState<Record<string, E>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      setCart(loadCart<E>(sessionStorage))
    } catch {
      // touching sessionStorage throws when site data is blocked: start empty
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      saveCart(sessionStorage, cart)
    } catch {
      // blocked storage: the cart still works in memory
    }
  }, [cart, loaded])

  return [cart, setCart] as const
}
