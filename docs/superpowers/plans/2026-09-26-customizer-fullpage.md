# Full-Page Item Customizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-item customizer modal with a full page at `/order/customize/[itemId]`, persist the `/order` cart across refreshes, and let simple items skip customization entirely.

**Architecture:** The cart moves behind a small `useCart()` hook backed by `sessionStorage` (`cart` key). The customize page does not own the cart. It queues its line into the existing `pendingCartEntries` handoff key, the same one `/deals` already uses, and `/order` merges that queue on load. Menu-item mapping and line pricing move out of `app/order/page.tsx` into `lib/menu-items.ts`, so the new page and the cart price lines with the same function.

**Tech Stack:** Next.js 16.2.7 App Router (client components), React 19.2, Tailwind 4, Vitest 4 (`environment: 'node'`, no jsdom), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-26-customizer-fullpage-design.md`

**Deliberate deviations from the spec (both simplify):**
- No `lib/use-item-customization.ts` hook. The drawer gets deleted, so the hook would have one consumer. The shared logic that matters is line pricing (`lineUnitPrice`), which moves to `lib/menu-items.ts` and is shared by the page and the cart.
- The customize page writes to `pendingCartEntries` (the existing `/deals` handoff) instead of calling `useCart()` itself. Only `/order` owns the cart, so two mounted owners can never race each other.

## Global Constraints

- Light theme, existing brand tokens only: `brand-red`, `brand-yellow`, `brand-dark`. No dark theme from the Stitch mockup.
- Deals/bundle popup (`components/Deals/DealSlotPicker.tsx`) is out of scope. It still uses `ModifierForm` and must render exactly as before (no numbers).
- No progress bar, no VAT line, no Save Preset (sub-projects C/D/E).
- No schema or API changes. The page reads the existing `/api/menu-items`.
- Price math must match `lib/checkout-pricing` exactly, because the checkout API rejects any mismatch. Always price through `lineUnitPrice`.
- Touch targets at least 44px (`min-h-[44px]`, `w-11 h-11`), matching the existing drawer.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md` before Task 4 (per AGENTS.md: this Next version differs from training data).
- The working tree has many unrelated dirty files. Stage only the paths each task lists. Never `git add -A` or `git add .`.

## Review Focus

1. **Cart after payment.** With the cart persisted, a customer who pays and later opens `/order` would still see the paid items. Expected: empty cart after a successful checkout. Handled in Task 2 Step 7.
2. **React StrictMode double effect.** Dev mode runs mount effects twice. If the first run consumes `pendingCartEntries` and the second reloads before the save, queued lines vanish. Expected: a line added from the customize page is always in the cart. Pinned by the test "loading twice keeps queued lines" in Task 2.
3. **Corrupt or foreign `sessionStorage`.** Examples: an old tab, a hand-edited value, a quota error. Expected: an empty cart, never a crash. Pinned by the test "corrupt JSON loads as empty" in Task 2.
4. **Direct link to a missing or sold-out item** (`/order/customize/nope`, or an item flipped to unavailable). Expected: a redirect to `/order`, no blank page. Handled in Task 4, checked manually in Task 6.
5. **Page total vs. cart total vs. checkout.** For an item with a paid spicy level plus extras at qty 2, all three numbers must match. Both the page and the cart use `lineUnitPrice`. Checked manually in Task 6.

---

### Task 1: Section counting and the "simple item" check

**Files:**
- Modify: `lib/order-modifiers.ts` (append after `toModifierConfig`)
- Test: `lib/order-modifiers.test.ts` (append)

**Interfaces:**
- Consumes: `ModifierConfig`, `toModifierConfig` (existing, same file).
- Produces: `sectionCount(c: ModifierConfig): number` and `hasNoCustomization(c: ModifierConfig): boolean`.

- [ ] **Step 1: Write the failing tests.** Append to `lib/order-modifiers.test.ts`, and add `sectionCount, hasNoCustomization` to the existing import from `./order-modifiers`:

```ts
describe('sectionCount / hasNoCustomization', () => {
  it('an item with nothing to choose has zero sections and skips the page', () => {
    const c = toModifierConfig({})
    expect(sectionCount(c)).toBe(0)
    expect(hasNoCustomization(c)).toBe(true)
  })

  it('empty arrays count as nothing to choose', () => {
    const c = toModifierConfig({ spicy_levels: [], ingredients: [], additions: [], drinks_regular: [] })
    expect(hasNoCustomization(c)).toBe(true)
  })

  it('only spicy levels is one section', () => {
    const c = toModifierConfig({ spicy_levels: [{ name: 'Mild', price: 0 }] })
    expect(sectionCount(c)).toBe(1)
    expect(hasNoCustomization(c)).toBe(false)
  })

  it('only free additions is one section', () => {
    const c = toModifierConfig({ additions: ['Ketchup'] })
    expect(sectionCount(c)).toBe(1)
    expect(hasNoCustomization(c)).toBe(false)
  })

  it('counts each non-empty priced category separately', () => {
    const c = toModifierConfig({
      spicy_levels: [{ name: 'Hot', price: 0.5 }],
      ingredients: ['Lettuce'],
      drinks_regular: [{ name: 'Coke', price: 1.2 }],
      dips: [{ name: 'Garlic', price: 0.5 }],
      additions: ['Napkins'],
    })
    expect(sectionCount(c)).toBe(5)
  })

  it('legacy removals/extras still count', () => {
    const c = toModifierConfig({ removals: ['No Mayo'], extras: [{ name: 'Cheese', price: 0.75 }] })
    expect(sectionCount(c)).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/order-modifiers.test.ts`
Expected: FAIL, `sectionCount is not a function` (or a TS import error).

- [ ] **Step 3: Implement.** Append to `lib/order-modifiers.ts`:

```ts
/** How many option sections the customizer shows for this config. Quantity and notes are not counted. */
export function sectionCount(c: ModifierConfig): number {
  return (
    (c.spicyLevels.length > 0 ? 1 : 0) +
    (c.ingredients.length > 0 ? 1 : 0) +
    c.categories.length +
    (c.additions.length > 0 ? 1 : 0)
  )
}

/** True when there is nothing to choose, so the item goes straight into the cart at qty 1. */
export const hasNoCustomization = (c: ModifierConfig): boolean => sectionCount(c) === 0
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run lib/order-modifiers.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add lib/order-modifiers.ts lib/order-modifiers.test.ts
git commit -m "feat(customizer): sectionCount and hasNoCustomization helpers"
```

---

### Task 2: Persisted cart (`useCart`) and shared menu-item module

**Files:**
- Create: `lib/use-cart.ts`
- Create: `lib/use-cart.test.ts`
- Create: `lib/menu-items.ts` (code moved out of `app/order/page.tsx`)
- Modify: `app/order/page.tsx`: the `MenuItem` type (≈line 27), `DbMenuItem` + `dbToMenuItem` (≈lines 261–307), `FALLBACK_IMG` (≈line 66), `lineUnitPrice` (≈line 312), and the cart `useState` + `pendingCartEntries` merge effect (≈lines 760–780)
- Modify: `app/checkout/page.tsx:327` (clear the persisted cart after a successful checkout)

**Interfaces:**
- Consumes: `addToLines`, `CartEntryLike`, `LineOptions` from `lib/cart-lines.ts`.
- Produces (`lib/use-cart.ts`):
  - `CART_KEY = 'cart'`, `PENDING_KEY = 'pendingCartEntries'`
  - `type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `loadCart<E extends CartEntryLike>(storage: StorageLike): Record<string, E>`
  - `saveCart(storage: StorageLike, cart: Record<string, CartEntryLike>): void`
  - `queueCartLine(storage: StorageLike, itemId: string, entry: LineOptions, qty: number): void`
  - `useCart<E extends CartEntryLike>(): readonly [Record<string, E>, Dispatch<SetStateAction<Record<string, E>>>]`
- Produces (`lib/menu-items.ts`): `MenuItem`, `DbMenuItem`, `FALLBACK_IMG`, `dbToMenuItem(item: DbMenuItem): MenuItem`, `lineUnitPrice(item: MenuItem, entry: { spicy_level?: string; extras: AddOn[] }): number`, `itemConfig(item: MenuItem): ModifierConfig`.

- [ ] **Step 1: Write the failing tests.** Create `lib/use-cart.test.ts`:

```ts
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
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/use-cart.test.ts`
Expected: FAIL, cannot resolve `./use-cart`.

- [ ] **Step 3: Implement `lib/use-cart.ts`**

```ts
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
    storage.removeItem(PENDING_KEY)
  }
  return cart
}

/** Queue one line for /order to pick up on its next load. */
export function queueCartLine(storage: StorageLike, itemId: string, entry: LineOptions, qty: number): void {
  const pending = readJson<Record<string, CartEntryLike>>(storage, PENDING_KEY) ?? {}
  storage.setItem(PENDING_KEY, JSON.stringify(addToLines(pending, itemId, entry, qty)))
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
    setCart(loadCart<E>(sessionStorage))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) saveCart(sessionStorage, cart)
  }, [cart, loaded])

  return [cart, setCart] as const
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npx vitest run lib/use-cart.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Create `lib/menu-items.ts`.** Move these out of `app/order/page.tsx` verbatim: the `MenuItem` type, `FALLBACK_IMG`, `DbMenuItem`, `dbToMenuItem`, `lineUnitPrice`. Add `export` to each and add `itemConfig`:

```ts
import type { ProductItem, AddOn } from '@/components/ProductModal'
import { spicyPrice, toModifierConfig, unitPrice, type ModifierConfig, type ModifierSource } from './order-modifiers'

export type MenuItem = ProductItem & {
  dietaryFlags?: string[]
  compare_at_price?: number | null
  is_available?: boolean
  sold_out_extras?: string[]
}

export const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80'

// ModifierSource carries the Phase 1 columns (spicy_levels, ingredients, the 8 priced
// categories, modifier_select_modes) plus the legacy extras/removals/additions.
export type DbMenuItem = ModifierSource & {
  /* ...fields copied unchanged from app/order/page.tsx... */
}

export function dbToMenuItem(item: DbMenuItem): MenuItem {
  /* ...body copied unchanged from app/order/page.tsx... */
}

/** Unit price of a cart line: base + chosen spicy level + extras. Must match lib/checkout-pricing. */
export function lineUnitPrice(item: MenuItem, entry: { spicy_level?: string; extras: AddOn[] }) {
  return unitPrice(item.price + spicyPrice(item.modifiers?.spicyLevels, entry.spicy_level), entry.extras)
}

/** The item's option config. Rows without Phase 1 data (and the static fallback menu) use the legacy lists. */
export function itemConfig(item: MenuItem): ModifierConfig {
  return item.modifiers ?? toModifierConfig({ removals: item.removables, additions: item.additions, extras: item.add_ons })
}
```

The two `/* ...copied unchanged... */` markers mean a literal cut-and-paste of the existing `DbMenuItem` fields and `dbToMenuItem` body (`app/order/page.tsx` ≈lines 265–307). Do not rewrite them.

In `app/order/page.tsx`, delete the moved definitions and import them instead:

```ts
import { dbToMenuItem, FALLBACK_IMG, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { useCart } from '@/lib/use-cart'
```

Then drop any names from the `@/lib/order-modifiers` import that are now unused. Run `npx tsc --noEmit` to see which ones.

- [ ] **Step 6: Switch `/order` to `useCart`.** In `OrderPage`, replace this block:

```ts
  const [cart, setCart] = useState<Cart>({})

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingCartEntries')
      ...
    } catch {
      // ignore corrupt storage
    }
  }, [])
```

with:

```ts
  // Persisted to sessionStorage; also merges lines queued by /deals and /order/customize.
  const [cart, setCart] = useCart<CartEntry>()
```

- [ ] **Step 7: Clear the persisted cart after checkout.** In `app/checkout/page.tsx`, add the import `import { CART_KEY } from '@/lib/use-cart'`. Then, next to the existing `sessionStorage.removeItem('pendingCart')` (≈line 327), add:

```ts
      sessionStorage.removeItem(CART_KEY)
```

This runs only after the checkout API has accepted the order. It matches when `pendingCart` is cleared today.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean. All tests pass (the previous total plus 6 new use-cart tests plus the Task 1 tests).

- [ ] **Step 9: Commit**

```bash
git add lib/use-cart.ts lib/use-cart.test.ts lib/menu-items.ts app/order/page.tsx app/checkout/page.tsx
git commit -m "fix(order): persist cart in sessionStorage; move menu-item mapping to lib"
```

---

### Task 3: Numbered section badges

**Files:**
- Modify: `components/Menu/ModifierSection.tsx:68-84` (default export)
- Modify: `components/Menu/ModifierForm.tsx` (add a `numbered` prop)

**Interfaces:**
- Produces: `ModifierSection` prop `number?: number`, and `ModifierForm` prop `numbered?: boolean` (default `false`, so `DealSlotPicker` is unchanged). With `numbered`, the sections are numbered 1..`sectionCount(config)` in render order: spicy, ingredients, categories, additions.

- [ ] **Step 1: Add the badge to `ModifierSection`.** Replace the default export:

```tsx
export default function ModifierSection({
  title, subtitle, number, children,
}: {
  title: string
  subtitle?: string
  /** Step number shown as a circle badge before the title. */
  number?: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="bg-brand-red px-5 py-2.5 flex items-center gap-3">
        {number != null && (
          <span
            aria-hidden="true"
            className="w-7 h-7 shrink-0 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center tabular-nums"
          >
            {number}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-heading font-semibold text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
```

- [ ] **Step 2: Number the sections in `ModifierForm`.** Add `numbered?: boolean` to `Props` with the doc comment `/** Show 1, 2, 3… badges on the section headers (full-page customizer only). */`. Destructure it as `numbered = false`. At the top of the function body add:

```ts
  // Sections render in a fixed order and empty ones are skipped, so a running counter
  // yields gap-free numbers that match sectionCount(config).
  let n = 0
  const nextNumber = () => (numbered ? ++n : undefined)
```

Then pass `number={nextNumber()}` to each of the four `<ModifierSection>` usages: Spicy level, Ingredients, the `config.categories.map` one, and Free additions. Each call sits inside its section's existing render condition, so it runs only for non-empty sections.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all pass. The deals popup passes no `numbered`, so its output is unchanged.

- [ ] **Step 4: Commit**

```bash
git add components/Menu/ModifierSection.tsx components/Menu/ModifierForm.tsx
git commit -m "feat(customizer): optional numbered badges on modifier sections"
```

---

### Task 4: The customize page

**Files:**
- Create: `app/order/customize/[itemId]/page.tsx`

**Interfaces:**
- Consumes: `dbToMenuItem`, `itemConfig`, `lineUnitPrice`, `DbMenuItem`, `MenuItem` (Task 2); `queueCartLine` (Task 2); `sectionCount`, `spicyPrice`, `formatExtra`, `extraQty` (Task 1 + existing); `ModifierForm` with `numbered`, and `ModifierSection` with `number` (Task 3); `QtyStepper` (existing, `components/Menu/QtyStepper.tsx`).
- Produces: route `/order/customize/[itemId]`.

- [ ] **Step 1: Read the Next docs.** Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md`. Confirm that `useParams<{ itemId: string }>()` returns a plain object in a client component (not a Promise).

- [ ] **Step 2: Create the page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, TriangleAlert } from 'lucide-react'
import ModifierForm, { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import ModifierSection from '@/components/Menu/ModifierSection'
import QtyStepper from '@/components/Menu/QtyStepper'
import { dbToMenuItem, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { extraQty, formatExtra, sectionCount, spicyPrice } from '@/lib/order-modifiers'
import { queueCartLine } from '@/lib/use-cart'

export default function CustomizeItemPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [qty, setQty] = useState(1)
  const [selection, setSelection] = useState<ModifierSelection>(EMPTY_SELECTION)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/menu-items')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<DbMenuItem[]>
      })
      .then((rows) => {
        if (cancelled) return
        const row = rows.find((r) => r.id === itemId)
        // Unknown id or sold out: nothing to customize here
        if (!row || !row.is_available) return router.replace('/order')
        setItem(dbToMenuItem(row))
      })
      .catch((err) => {
        console.error('Failed to load menu item:', err)
        if (!cancelled) router.replace('/order')
      })
    return () => { cancelled = true }
  }, [itemId, router])

  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/order'))

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-pulse" aria-busy="true" aria-label="Loading item">
        <div className="h-5 w-32 bg-zinc-100 rounded mb-6" />
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-64 bg-zinc-100 rounded-3xl" />
            <div className="h-40 bg-zinc-100 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-72 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  const config = itemConfig(item)
  const spicyCost = spicyPrice(config.spicyLevels, selection.spicy)
  // Same function the cart uses, so page total == cart total == checkout
  const unit = lineUnitPrice(item, { spicy_level: selection.spicy ?? undefined, extras: selection.extras })
  const total = unit * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const categoryLabel = (key?: string) => config.categories.find((c) => c.key === key)?.label ?? key
  const hasSelection =
    selection.spicy != null || selection.removals.length > 0 || selection.extras.length > 0 ||
    selection.additions.length > 0 || notes.trim().length > 0

  const handleAdd = () => {
    queueCartLine(sessionStorage, item.id, {
      spicy_level: selection.spicy ?? undefined,
      removals: selection.removals,
      additions: selection.additions,
      extras: selection.extras,
      notes: notes.trim() || undefined,
    }, qty)
    router.push('/order')
  }

  const addButton = (
    <button
      onClick={handleAdd}
      className="w-full min-h-[44px] font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20"
    >
      <span className="flex items-center gap-2 text-base">
        <ShoppingBag size={18} />
        Add{qty > 1 ? ` ${qty}×` : ''} to Order
      </span>
      <span className="text-base tabular-nums">£{total.toFixed(2)}</span>
    </button>
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 lg:pb-12">
        <button
          onClick={goBack}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to menu
        </button>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: hero + numbered sections */}
          <div className="lg:col-span-8 space-y-6">
            <header className="grid sm:grid-cols-2 gap-5 items-center">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100">
                <Image src={item.image} alt={item.name} fill priority sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
                {isOffer && (
                  <div className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl shadow-lg">
                    🔥 OFFER
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-heading font-black text-3xl text-zinc-900 leading-tight">{item.name}</h1>
                {item.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{item.description}</p>}
                <div className="mt-3">
                  {isOffer && (
                    <span className="text-sm text-zinc-400 line-through mr-2">£{item.compare_at_price!.toFixed(2)}</span>
                  )}
                  <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
                    £{item.price.toFixed(2)}
                  </span>
                </div>
                {item.allergens.length > 0 && (
                  <p className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-800 text-xs font-medium w-fit">
                    <TriangleAlert size={12} className="shrink-0" />
                    Contains: {item.allergens.join(', ')}
                  </p>
                )}
              </div>
            </header>

            <div className="rounded-2xl border border-zinc-100 overflow-hidden divide-y divide-zinc-100">
              <ModifierForm
                config={config}
                value={selection}
                onChange={setSelection}
                soldOut={item.sold_out_extras}
                numbered
              />
              <ModifierSection
                number={sectionCount(config) + 1}
                title="Special instructions"
                subtitle="Allergies, preferences or anything else"
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Extra sauce on the side, well done…"
                  rows={3}
                  maxLength={200}
                  aria-label="Special instructions"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
                />
              </ModifierSection>
            </div>
          </div>

          {/* Right: summary. Sticky sidebar on desktop, a plain card below the sections on mobile. */}
          <aside className="lg:col-span-4 lg:sticky lg:top-6 rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4" aria-label="Your order">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-zinc-900">Your selection</h2>
              <QtyStepper value={qty} onChange={setQty} label={item.name} min={1} max={99} />
            </div>

            {hasSelection ? (
              <ul className="space-y-1.5 text-sm">
                {selection.spicy && (
                  <li className="flex justify-between text-zinc-700">
                    <span>Spicy level: {selection.spicy}</span>
                    {spicyCost > 0 && <span className="tabular-nums">+£{spicyCost.toFixed(2)}</span>}
                  </li>
                )}
                {selection.removals.map((r) => (
                  <li key={`removed-${r}`} className="flex justify-between text-zinc-500">
                    <span className="line-through">{r}</span>
                    <span>Removed</span>
                  </li>
                ))}
                {selection.extras.map((e) => (
                  <li key={`${e.category}-${e.name}`} className="flex justify-between text-zinc-700">
                    <span>{formatExtra(e)} <span className="text-zinc-400 text-xs">({categoryLabel(e.category)})</span></span>
                    <span className="tabular-nums">{e.price > 0 ? `+£${(e.price * extraQty(e)).toFixed(2)}` : 'Free'}</span>
                  </li>
                ))}
                {selection.additions.map((a) => (
                  <li key={`add-${a}`} className="flex justify-between text-zinc-700">
                    <span>{a}</span>
                    <span className="text-zinc-400">Free</span>
                  </li>
                ))}
                {notes.trim() && (
                  <li className="text-zinc-500 italic pt-1 border-t border-zinc-100 mt-1">&ldquo;{notes.trim()}&rdquo;</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">No changes, served as described.</p>
            )}

            <div className="flex justify-between items-baseline border-t border-zinc-100 pt-4">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="font-heading font-black text-2xl text-zinc-900 tabular-nums">£{total.toFixed(2)}</span>
            </div>

            <div className="hidden lg:block">{addButton}</div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {addButton}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit && npx eslint "app/order/customize/[itemId]/page.tsx"`
Expected: clean. If eslint flags `setState` inside the effect (`react-hooks/set-state-in-effect`), check how `app/order/page.tsx` handles the same rule and match it. Do not disable the rule file-wide.

- [ ] **Step 4: Commit**

```bash
git add "app/order/customize/[itemId]/page.tsx"
git commit -m "feat(customizer): full-page item customizer route"
```

---

### Task 5: Wire `/order` to the page and delete the drawer

**Files:**
- Modify: `app/order/page.tsx`: imports (lines 1–23), `drawerItem` state (≈line 786), `handleAddToOrder` (≈lines 950–958), both `onOpenDrawer={() => setDrawerItem(item)}` (≈lines 1198, 1238), the drawer JSX (≈lines 1286–1292)
- Delete: `components/Menu/ItemCustomizerDrawer.tsx`

**Interfaces:**
- Consumes: `hasNoCustomization` (Task 1), `itemConfig` (Task 2), route `/order/customize/[itemId]` (Task 4).

- [ ] **Step 1: Add `openItem`.** Import `useRouter` from `next/navigation` and `hasNoCustomization` from `@/lib/order-modifiers`. In `OrderPage`, add `const router = useRouter()` next to the other hooks. Next to `addToCart`, add:

```ts
  // Simple items (nothing to choose) go straight in at qty 1; anything else opens the customize page.
  function openItem(item: MenuItem) {
    if (hasNoCustomization(itemConfig(item))) addToCart(item.id)
    else router.push(`/order/customize/${item.id}`)
  }
```

- [ ] **Step 2: Replace both call sites.** Change `onOpenDrawer={() => setDrawerItem(item)}` to `onOpenDrawer={() => openItem(item)}` in both `MenuCard` usages.

- [ ] **Step 3: Remove the drawer.** Delete the `drawerItem` state line, the `handleAddToOrder` function, the `{drawerItem && (<ItemCustomizerDrawer … />)}` block, and the `ItemCustomizerDrawer` import. Remove `OrderSelection` from the `ProductModal` import if nothing else references it. Then:

```bash
git rm components/Menu/ItemCustomizerDrawer.tsx
grep -rn "ItemCustomizerDrawer" app components lib
```

Expected: the grep prints nothing.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run && npx eslint app/order/page.tsx`
Expected: all clean and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/order/page.tsx
git commit -m "feat(customizer): menu opens full-page customizer, simple items add directly; remove drawer"
```

---

### Task 6: Browser verification

No code. Evidence only. Start `npm run dev` (or reuse a running dev server) and use the browser tools.

- [ ] **Step 1: Loaded item, desktop at 1280px.** Open `/order` and click a fully loaded item (the Classic Smash Burger was live-verified in sub-project A). Check that the URL is `/order/customize/<id>`, the sections are numbered 1..N with no gaps, Special instructions is N+1, and the sidebar stays sticky on scroll. Pick a paid spicy level, two extras, and qty 2. Note the total.
- [ ] **Step 2: Add and check the cart.** Click Add to Order. You should land on `/order` and the cart pill should show the same total as Step 1. Open the cart drawer: one line with the chosen options.
- [ ] **Step 3: Refresh `/order`.** The cart is still there (the spec's refresh bug is fixed).
- [ ] **Step 4: Checkout total.** Proceed to `/checkout`. The subtotal must equal Step 1's total. Do not pay.
- [ ] **Step 5: Mobile at 375px.** Open the same item. There is no horizontal scroll, the sticky bottom bar shows the Add button with the total, and the summary card sits below the sections.
- [ ] **Step 6: Simple item.** Find an item for which `hasNoCustomization` is true (a plain drink). Tapping it adds qty 1 with no navigation.
- [ ] **Step 7: Bad links.** `/order/customize/does-not-exist` should redirect to `/order`.
- [ ] **Step 8: Deals popup unchanged.** Open a meal deal from a card. The popup still appears, and its sections have no number badges.
- [ ] **Step 9: Refresh the knowledge graph.** Run `/graphify . --update`, then commit `graphify-out/` changes as `chore(graph): refresh knowledge graph` (staging only `graphify-out/`).
