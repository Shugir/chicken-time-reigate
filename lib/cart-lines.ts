// Cart lines are keyed by item plus options, so two units of the same item with different
// options stay separate lines instead of overwriting each other. Identical options merge.

import { extraQty, type SelectedExtra } from './order-modifiers'

export interface LineOptions {
  spicy_level?: string
  removals: string[]
  additions: string[]
  extras: SelectedExtra[]
  notes?: string
}

export type CartEntryLike = LineOptions & { qty: number }

const SEP = '#'

/** Bare item id when the line has no options; otherwise item id plus a canonical option string. */
export function lineKey(itemId: string, o: Partial<LineOptions> = {}): string {
  const removals = [...(o.removals ?? [])].sort()
  const additions = [...(o.additions ?? [])].sort()
  const extras = [...(o.extras ?? [])]
    .map((e) => [e.category ?? '', e.name, extraQty(e)] as const)
    .sort((a, b) => (a[0] + '\u0000' + a[1]).localeCompare(b[0] + '\u0000' + b[1]))
  const spicy = o.spicy_level ?? ''
  const notes = o.notes?.trim() ?? ''
  if (!spicy && !removals.length && !additions.length && !extras.length && !notes) return itemId
  return itemId + SEP + JSON.stringify([spicy, removals, additions, extras, notes])
}

export function itemIdOfKey(key: string): string {
  const i = key.indexOf(SEP)
  return i === -1 ? key : key.slice(0, i)
}

/** Adds `qty` units with these options, merging into an identical existing line. */
export function addToLines<E extends CartEntryLike>(
  cart: Record<string, E>,
  itemId: string,
  entry: Omit<E, 'qty'> | E,
  qty: number,
): Record<string, E> {
  const key = lineKey(itemId, entry)
  const current = cart[key]
  return { ...cart, [key]: current ? { ...current, qty: current.qty + qty } : ({ ...entry, qty } as E) }
}

/** Changes one line's quantity; a line that reaches zero is removed. Unknown key returns the same cart. */
export function changeLineQty<E extends CartEntryLike>(cart: Record<string, E>, key: string, delta: number): Record<string, E> {
  const current = cart[key]
  if (!current) return cart
  const qty = current.qty + delta
  if (qty <= 0) {
    const next = { ...cart }
    delete next[key]
    return next
  }
  return { ...cart, [key]: { ...current, qty } }
}

/** Total units of one item across all its lines. */
export function itemQty(cart: Record<string, CartEntryLike>, itemId: string): number {
  return Object.entries(cart).reduce((s, [key, e]) => (itemIdOfKey(key) === itemId ? s + e.qty : s), 0)
}

/** Removes one unit of an item: from the plain line if there is one, else from its latest customized line. */
export function removeOneFromItem<E extends CartEntryLike>(cart: Record<string, E>, itemId: string): Record<string, E> {
  if (cart[itemId]) return changeLineQty(cart, itemId, -1)
  const keys = Object.keys(cart).filter((k) => itemIdOfKey(k) === itemId)
  const last = keys[keys.length - 1]
  return last ? changeLineQty(cart, last, -1) : cart
}
