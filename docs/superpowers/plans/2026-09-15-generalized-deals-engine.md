# Generalized Deals Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed medium/large combo wizard with an admin-configurable deals engine (BOGO, build-a-bundle, fixed-price meal, order/category discount) that auto-detects and auto-applies whenever a customer's cart qualifies — reusing the existing promo-code discount pipeline rather than a parallel one.

**Architecture:** One pure matching function (`lib/deal-engine.ts`) is the single source of truth for "does this cart qualify for a deal, and for how much" — called server-side at checkout (authoritative) and server-side from a public quote endpoint (client preview only). Bundle/fixed-meal items are added to the cart as their real individual menu items; nothing is collapsed into a synthetic cart line the way the old combo wizard did it.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + supabase-js), TypeScript, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-15-generalized-deals-engine-design.md`

## Global Constraints

- `menu_items.category` is a plain text column storing a `categories.slug` value (e.g. `'sides'`) — there is no `category_id` FK anywhere in this schema. All deal config that filters by category uses this same slug string.
- Checkout (`app/api/checkout/route.ts`) is the only authoritative place discounts get computed for a real order — any client-side "quote" (cart preview, `/checkout` page display) is advisory only and must be re-verified server-side. Never trust a client-supplied discount amount.
- New permission string: `'Deals'`, following the exact existing pattern of `'MenuManager'`, `'Receipts'`, etc. in `app/admin/staff/page.tsx` / `lib/get-user-permissions.ts` — no schema change, `owner` role always passes `hasPermission`.
- Do not drop `combo_category`/`size_tier` columns on `menu_items` or the `combo_discounts` table in this plan — leave them inert. Do not delete the legacy `/menu/combo` page or its API routes until Task 12 (after manual verification).
- `app/order/page.tsx` and `components/Menu/ItemCustomizerDrawer.tsx` currently have uncommitted, in-progress changes implementing a "SINGLE / MEAL DEAL" dual-row card driven by the *old* combo system. Task 10 builds on top of that existing UI pattern and rewires it to the new engine — it does not introduce a new visual pattern.
- Money math: always round to 2dp with `Math.round(n * 100) / 100` before it reaches a total or a Stripe amount.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260915d_deals_engine.sql`

**Interfaces:**
- Produces: `deals` table (`id`, `type`, `name`, `config` jsonb, `is_active`, `created_at`, `updated_at`), `orders.applied_deals` jsonb column. Later tasks read/write both by these exact names.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260915d_deals_engine.sql

CREATE TYPE deal_type AS ENUM ('bogo', 'bundle', 'fixed_meal', 'order_discount');

CREATE TABLE deals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        deal_type NOT NULL,
  name        TEXT NOT NULL,
  config      JSONB NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read active deals"
  ON deals FOR SELECT USING (true);

CREATE POLICY "service role full access on deals"
  ON deals USING (auth.role() = 'service_role');

ALTER TABLE orders ADD COLUMN applied_deals JSONB DEFAULT NULL;

-- Legacy migration: fold the live medium/large combo_discounts rows into
-- two seed `bundle` deals so nothing is lost when /menu/combo is removed
-- (Task 12). This uses category slugs directly — if items tagged
-- combo_category='main' span more than one category slug in your live
-- data, edit the `category` values below (or switch that group to
-- item_ids) before running this migration; check with:
--   SELECT DISTINCT category FROM menu_items WHERE combo_category = 'main';
DO $$
DECLARE
  medium_discount NUMERIC;
  large_discount  NUMERIC;
BEGIN
  SELECT discount_amount INTO medium_discount FROM combo_discounts WHERE meal_size = 'medium' LIMIT 1;
  SELECT discount_amount INTO large_discount  FROM combo_discounts WHERE meal_size = 'large'  LIMIT 1;

  IF medium_discount IS NOT NULL THEN
    INSERT INTO deals (type, name, config, is_active) VALUES (
      'bundle',
      'Medium Meal Deal',
      jsonb_build_object(
        'groups', jsonb_build_array(
          jsonb_build_object('label', 'Main',  'category', 'chicken', 'pick_qty', 1),
          jsonb_build_object('label', 'Side',  'category', 'sides',   'pick_qty', 1),
          jsonb_build_object('label', 'Drink', 'category', 'drinks',  'pick_qty', 1)
        ),
        'price', GREATEST(0, (
          SELECT AVG(price) FROM menu_items WHERE combo_category = 'main'
        ) - medium_discount)
      ),
      true
    );
  END IF;

  IF large_discount IS NOT NULL THEN
    INSERT INTO deals (type, name, config, is_active) VALUES (
      'bundle',
      'Large Meal Deal',
      jsonb_build_object(
        'groups', jsonb_build_array(
          jsonb_build_object('label', 'Main',  'category', 'chicken', 'pick_qty', 1),
          jsonb_build_object('label', 'Side',  'category', 'sides',   'pick_qty', 1),
          jsonb_build_object('label', 'Drink', 'category', 'drinks',  'pick_qty', 1)
        ),
        'price', GREATEST(0, (
          SELECT AVG(price) FROM menu_items WHERE combo_category = 'main'
        ) - large_discount)
      ),
      true
    );
  END IF;
END $$;
```

- [ ] **Step 2: Apply it**

```bash
supabase db query --linked -f supabase/migrations/20260915d_deals_engine.sql
```

- [ ] **Step 3: Verify**

```bash
supabase db query --linked "select id, type, name, config, is_active from deals;"
supabase db query --linked "select column_name from information_schema.columns where table_name='orders' and column_name='applied_deals';"
```

Expected: two `bundle` rows (skip if `combo_discounts` was empty), `applied_deals` column present. If the seeded `Main` category slug (`'chicken'`) doesn't match your live category naming, edit the two rows via `UPDATE deals SET config = jsonb_set(config, '{groups,0,category}', '"<real-slug>"') WHERE name = '...';` — this is expected manual follow-up, not a plan defect.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260915d_deals_engine.sql
git commit -m "feat: add deals table and orders.applied_deals column"
```

---

### Task 2: Deal matching engine (TDD)

**Files:**
- Create: `lib/deal-engine.ts`
- Test: `lib/deal-engine.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `export type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'`
  - `export interface MenuItemLite { id: string; price: number; category: string; is_available: boolean }`
  - `export interface DealCartItem { menu_item_id?: string; quantity: number }`
  - `export interface Deal { id: string; type: DealType; name: string; config: unknown; is_active: boolean }`
  - `export interface AppliedDeal { deal_id: string; name: string; type: DealType; savings: number }`
  - `export function matchDeals(cartItems: DealCartItem[], activeDeals: Deal[], menuItemsById: Map<string, MenuItemLite>): { applied: AppliedDeal[]; totalDiscount: number }`

Later tasks (checkout route, quote route) import exactly these names from `@/lib/deal-engine`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/deal-engine.test.ts
import { describe, it, expect } from 'vitest'
import { matchDeals, type Deal, type MenuItemLite, type DealCartItem } from './deal-engine'

function menuMap(items: MenuItemLite[]): Map<string, MenuItemLite> {
  return new Map(items.map((i) => [i.id, i]))
}

describe('matchDeals — bogo', () => {
  it('applies buy-one-get-one-free on the same item', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0].name).toBe('BOGO Wings')
    expect(result.totalDiscount).toBe(5)
  })

  it('does not apply when quantity is insufficient', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
    expect(result.totalDiscount).toBe(0)
  })

  it('applies across two different items (buy fries get drink 50% off)', () => {
    const menuItems = menuMap([
      { id: 'fries', price: 3, category: 'sides', is_available: true },
      { id: 'cola',  price: 2, category: 'drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'Fries + Half Price Drink', is_active: true,
      config: {
        buy: { item_ids: ['fries'], qty: 1 },
        get: { item_ids: ['cola'], qty: 1, discount: { percent: 50 } },
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'fries', quantity: 1 }, { menu_item_id: 'cola', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.totalDiscount).toBe(1)
  })
})

describe('matchDeals — bundle', () => {
  it('consumes the highest-priced qualifying item per group', () => {
    const menuItems = menuMap([
      { id: 'chicken-a', price: 6, category: 'chicken', is_available: true },
      { id: 'chicken-b', price: 8, category: 'chicken', is_available: true },
      { id: 'side-a',    price: 2, category: 'sides',   is_available: true },
      { id: 'drink-a',   price: 1.5, category: 'drinks', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', category: 'chicken', pick_qty: 1 },
          { label: 'Side', category: 'sides', pick_qty: 1 },
          { label: 'Drink', category: 'drinks', pick_qty: 1 },
        ],
        price: 9,
      },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'chicken-a', quantity: 1 },
      { menu_item_id: 'chicken-b', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 1 },
      { menu_item_id: 'drink-a', quantity: 1 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // Picks chicken-b (£8, the pricier main) into the bundle: 8+2+1.5=11.5 - 9 = 2.5 savings
    expect(result.totalDiscount).toBe(2.5)
  })

  it('does not apply when a group has too few qualifying items', () => {
    const menuItems = menuMap([{ id: 'chicken-a', price: 6, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', category: 'chicken', pick_qty: 1 },
          { label: 'Side', category: 'sides', pick_qty: 1 },
        ],
        price: 5,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'chicken-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })
})

describe('matchDeals — fixed_meal', () => {
  it('applies when every required item/qty is present', () => {
    const menuItems = menuMap([
      { id: 'whole-chicken', price: 12, category: 'chicken', is_available: true },
      { id: 'side-a', price: 2, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'fixed_meal', name: 'Family Feast', is_active: true,
      config: { items: [{ item_id: 'whole-chicken', qty: 1 }, { item_id: 'side-a', qty: 2 }], price: 13 },
    }]
    const cart: DealCartItem[] = [
      { menu_item_id: 'whole-chicken', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 2 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // 12 + 2*2 = 16 - 13 = 3
    expect(result.totalDiscount).toBe(3)
  })
})

describe('matchDeals — order_discount', () => {
  it('applies a percent-off-order discount above min_subtotal', () => {
    const menuItems = menuMap([{ id: 'item-a', price: 30, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'order_discount', name: '10% Off Orders Over £20', is_active: true,
      config: { scope: 'order', min_subtotal: 20, discount: { type: 'percent', value: 10 } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'item-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.totalDiscount).toBe(3)
  })

  it('does not apply below min_subtotal', () => {
    const menuItems = menuMap([{ id: 'item-a', price: 10, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'order_discount', name: '10% Off Orders Over £20', is_active: true,
      config: { scope: 'order', min_subtotal: 20, discount: { type: 'percent', value: 10 } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'item-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })
})

describe('matchDeals — combining deals and edge cases', () => {
  it('applies both an item deal and an order discount on the remaining subtotal', () => {
    const menuItems = menuMap([
      { id: 'wing', price: 5, category: 'chicken', is_available: true },
      { id: 'filler', price: 20, category: 'sides', is_available: true },
    ])
    const deals: Deal[] = [
      {
        id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
        config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
      },
      {
        id: 'd2', type: 'order_discount', name: '10% Off', is_active: true,
        config: { scope: 'order', discount: { type: 'percent', value: 10 } },
      },
    ]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }, { menu_item_id: 'filler', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied.map((a) => a.deal_id).sort()).toEqual(['d1', 'd2'])
    // BOGO saves 5 (one wing free). Remaining subtotal = 5 (paid wing) + 20 (filler) = 25. 10% of 25 = 2.5
    expect(result.totalDiscount).toBe(7.5)
  })

  it('ignores sold-out items entirely', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: false }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: true,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })

  it('ignores inactive deals', () => {
    const menuItems = menuMap([{ id: 'wing', price: 5, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bogo', name: 'BOGO Wings', is_active: false,
      config: { buy: { item_ids: ['wing'], qty: 1 }, get: { item_ids: ['wing'], qty: 1, discount: 'free' } },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'wing', quantity: 2 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/deal-engine.test.ts
```

Expected: FAIL — `Cannot find module './deal-engine'`.

- [ ] **Step 3: Implement `lib/deal-engine.ts`**

```ts
// lib/deal-engine.ts

export type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'

export interface MenuItemLite {
  id: string
  price: number
  category: string
  is_available: boolean
}

export interface DealCartItem {
  menu_item_id?: string
  quantity: number
}

export interface Deal {
  id: string
  type: DealType
  name: string
  config: unknown
  is_active: boolean
}

export interface AppliedDeal {
  deal_id: string
  name: string
  type: DealType
  savings: number
}

interface Ref {
  category?: string
  item_ids?: string[]
}

interface BogoConfig {
  buy: Ref & { qty: number }
  get: Ref & { qty: number; discount: 'free' | { percent: number } }
}

interface BundleConfig {
  groups: { label: string; category: string; pick_qty: number }[]
  price: number
}

interface FixedMealConfig {
  items: { item_id: string; qty: number }[]
  price: number
}

interface OrderDiscountConfig {
  scope: 'order' | 'category'
  category?: string
  min_subtotal?: number
  discount: { type: 'percent' | 'amount'; value: number }
}

interface Unit {
  menu_item_id: string
  category: string
  price: number
  consumed: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function matchesRef(unit: Unit, ref: Ref): boolean {
  if (ref.item_ids && ref.item_ids.length > 0) return ref.item_ids.includes(unit.menu_item_id)
  if (ref.category) return unit.category === ref.category
  return false
}

function sameRef(a: Ref, b: Ref): boolean {
  if (a.item_ids && b.item_ids) {
    return a.item_ids.length === b.item_ids.length && a.item_ids.every((id) => b.item_ids!.includes(id))
  }
  return Boolean(a.category) && a.category === b.category
}

function priceAfterDiscount(price: number, discount: 'free' | { percent: number }): number {
  return discount === 'free' ? price : price * (discount.percent / 100)
}

function evaluateItemDeal(deal: Deal, available: Unit[]): { savings: number; consume: Unit[] } | null {
  if (deal.type === 'bogo') {
    const cfg = deal.config as BogoConfig
    const buyPool = available.filter((u) => matchesRef(u, cfg.buy))
    const getPool = available.filter((u) => matchesRef(u, cfg.get))

    if (sameRef(cfg.buy, cfg.get)) {
      const groupSize = cfg.buy.qty + cfg.get.qty
      const applications = Math.floor(buyPool.length / groupSize)
      if (applications < 1) return null
      const sorted = [...buyPool].sort((a, b) => b.price - a.price)
      const getUnits = sorted.slice(0, applications * cfg.get.qty)
      const buyUnits = sorted.slice(applications * cfg.get.qty, applications * groupSize)
      const savings = getUnits.reduce((s, u) => s + priceAfterDiscount(u.price, cfg.get.discount), 0)
      return savings > 0 ? { savings, consume: [...getUnits, ...buyUnits] } : null
    }

    const applications = Math.min(
      Math.floor(buyPool.length / cfg.buy.qty),
      Math.floor(getPool.length / cfg.get.qty),
    )
    if (applications < 1) return null
    const getUnits = [...getPool].sort((a, b) => b.price - a.price).slice(0, applications * cfg.get.qty)
    const buyUnits = [...buyPool].sort((a, b) => b.price - a.price).slice(0, applications * cfg.buy.qty)
    const savings = getUnits.reduce((s, u) => s + priceAfterDiscount(u.price, cfg.get.discount), 0)
    return savings > 0 ? { savings, consume: [...getUnits, ...buyUnits] } : null
  }

  if (deal.type === 'bundle') {
    const cfg = deal.config as BundleConfig
    const consume: Unit[] = []
    let sum = 0
    for (const group of cfg.groups) {
      const pool = available
        .filter((u) => !consume.includes(u) && u.category === group.category)
        .sort((a, b) => b.price - a.price)
      if (pool.length < group.pick_qty) return null
      const picked = pool.slice(0, group.pick_qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume } : null
  }

  if (deal.type === 'fixed_meal') {
    const cfg = deal.config as FixedMealConfig
    const consume: Unit[] = []
    let sum = 0
    for (const req of cfg.items) {
      const pool = available.filter((u) => !consume.includes(u) && u.menu_item_id === req.item_id)
      if (pool.length < req.qty) return null
      const picked = pool.slice(0, req.qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume } : null
  }

  return null
}

/**
 * Pure matching engine. Runs item-consuming deals (bogo/bundle/fixed_meal)
 * greedily by best marginal savings first, then applies the single best
 * order_discount deal (if any) against whatever subtotal remains.
 *
 * ponytail: greedy best-marginal-savings, not an exhaustive search over all
 * deal combinations — correct/tied-optimal at realistic scale (a handful of
 * concurrent deals, single-digit cart lines). Revisit if the deal catalog
 * grows past ~20 concurrently active deals.
 */
export function matchDeals(
  cartItems: DealCartItem[],
  activeDeals: Deal[],
  menuItemsById: Map<string, MenuItemLite>,
): { applied: AppliedDeal[]; totalDiscount: number } {
  const units: Unit[] = []
  for (const item of cartItems) {
    if (!item.menu_item_id) continue
    const db = menuItemsById.get(item.menu_item_id)
    if (!db || !db.is_available) continue
    for (let i = 0; i < item.quantity; i++) {
      units.push({ menu_item_id: db.id, category: db.category, price: db.price, consumed: false })
    }
  }

  const originalSubtotal = units.reduce((s, u) => s + u.price, 0)
  const applied: AppliedDeal[] = []
  let totalDiscount = 0

  const itemDeals = activeDeals.filter((d) => d.is_active && d.type !== 'order_discount')
  const orderDeals = activeDeals.filter((d) => d.is_active && d.type === 'order_discount')

  for (;;) {
    const available = units.filter((u) => !u.consumed)
    let best: { deal: Deal; savings: number; consume: Unit[] } | null = null

    for (const deal of itemDeals) {
      const result = evaluateItemDeal(deal, available)
      if (result && result.savings > 0 && (!best || result.savings > best.savings)) {
        best = { deal, savings: result.savings, consume: result.consume }
      }
    }

    if (!best) break
    best.consume.forEach((u) => { u.consumed = true })
    applied.push({ deal_id: best.deal.id, name: best.deal.name, type: best.deal.type, savings: round2(best.savings) })
    totalDiscount += best.savings
  }

  const remaining = units.filter((u) => !u.consumed)
  let bestOrderDeal: { deal: Deal; savings: number } | null = null
  for (const deal of orderDeals) {
    const cfg = deal.config as OrderDiscountConfig
    if (cfg.min_subtotal && originalSubtotal < cfg.min_subtotal) continue
    const pool = cfg.scope === 'category' ? remaining.filter((u) => u.category === cfg.category) : remaining
    if (pool.length === 0) continue
    const poolSum = pool.reduce((s, u) => s + u.price, 0)
    const savings = cfg.discount.type === 'percent'
      ? poolSum * (cfg.discount.value / 100)
      : Math.min(cfg.discount.value, poolSum)
    if (savings > 0 && (!bestOrderDeal || savings > bestOrderDeal.savings)) {
      bestOrderDeal = { deal, savings }
    }
  }
  if (bestOrderDeal) {
    applied.push({
      deal_id: bestOrderDeal.deal.id,
      name: bestOrderDeal.deal.name,
      type: 'order_discount',
      savings: round2(bestOrderDeal.savings),
    })
    totalDiscount += bestOrderDeal.savings
  }

  return { applied, totalDiscount: round2(totalDiscount) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/deal-engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/deal-engine.ts lib/deal-engine.test.ts
git commit -m "feat: add pure deal-matching engine with tests"
```

---

### Task 3: Admin API — deals CRUD

**Files:**
- Create: `app/api/admin/deals/route.ts`
- Create: `app/api/admin/deals/[id]/route.ts`

**Interfaces:**
- Consumes: `getUserPermissions`, `hasPermission` from `@/lib/get-user-permissions` (existing); `supabaseAdmin` from `@/lib/supabase-admin` (existing).
- Produces: `GET/POST /api/admin/deals`, `PATCH/DELETE /api/admin/deals/[id]` — consumed by Task 4's admin UI.

- [ ] **Step 1: Create the collection route**

```ts
// app/api/admin/deals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['bogo', 'bundle', 'fixed_meal', 'order_discount']

function validateConfig(type: string, config: unknown): string | null {
  if (typeof config !== 'object' || config === null) return 'config must be an object'
  const c = config as Record<string, unknown>
  if (type === 'bogo') {
    if (typeof c.buy !== 'object' || typeof c.get !== 'object') return 'bogo requires buy and get'
  }
  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
  }
  if (type === 'fixed_meal') {
    if (!Array.isArray(c.items) || c.items.length === 0) return 'fixed_meal requires a non-empty items array'
    if (typeof c.price !== 'number' || c.price < 0) return 'fixed_meal requires a non-negative price'
  }
  if (type === 'order_discount') {
    if (c.scope !== 'order' && c.scope !== 'category') return 'order_discount scope must be order or category'
    if (typeof c.discount !== 'object') return 'order_discount requires a discount object'
  }
  return null
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Deals')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, name, config, is_active = true } = await request.json()

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const configError = validateConfig(type, config)
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('deals')
    .insert({ type, name: name.trim(), config, is_active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create the item route**

```ts
// app/api/admin/deals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Deals')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active
  if (body.config !== undefined) update.config = body.config
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('deals')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Deals')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
curl -s http://localhost:3000/api/admin/deals | python -m json.tool
```

Expected: 200 with the two seeded bundle deals from Task 1 (GET has no permission check by design, matching the existing `combo-discounts` GET — write operations are gated). Then confirm POST without a session returns 403:

```bash
curl -s -X POST http://localhost:3000/api/admin/deals -H "Content-Type: application/json" -d "{\"type\":\"bogo\",\"name\":\"Test\",\"config\":{\"buy\":{},\"get\":{}}}"
```

Expected: `{"error":"Forbidden"}` with status 403.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/deals
git commit -m "feat: add admin CRUD API for deals"
```

---

### Task 4: Admin UI — permission entry, nav, and the Deals page

**Files:**
- Modify: `app/admin/staff/page.tsx` (add `'Deals'` to `ALL_PERMISSIONS`)
- Modify: `components/admin/admin-sidebar.tsx` (add nav entry, replace the old `combos` entry)
- Create: `app/admin/deals/page.tsx`
- Create: `app/admin/deals/layout.tsx` (mirror `app/admin/combos/layout.tsx` if it does anything beyond a passthrough — check it first; if it's a plain passthrough, copy it verbatim)

**Interfaces:**
- Consumes: `GET/POST /api/admin/deals`, `PATCH/DELETE /api/admin/deals/[id]` (Task 3); `GET /api/categories` (existing, returns `{id, name, slug, ...}[]`).

- [ ] **Step 1: Check `app/admin/combos/layout.tsx` and mirror it for `app/admin/deals/layout.tsx`**

Read the file; if it is a plain children-passthrough (no combos-specific logic), create an identical `app/admin/deals/layout.tsx`. If it contains combos-specific logic, adapt only the naming.

- [ ] **Step 2: Add the permission entry**

In `app/admin/staff/page.tsx`, in the `ALL_PERMISSIONS` array, add a row right after `'Promotions'`:

```ts
  { key: 'Deals',              label: 'Deals',                desc: 'Create and manage BOGO, bundle, meal and order-wide deals' },
```

- [ ] **Step 3: Update the sidebar nav**

In `components/admin/admin-sidebar.tsx`, replace the `combos` row in the `Menu` group with a `deals` row (same group, same icon import already available):

```ts
      { id: 'deals',      label: 'Deals',          icon: Tag,             href: '/admin/deals',     permission: 'Deals'         },
```

Remove the old `{ id: 'combos', ... }` line entirely (the `/admin/combos` page and its permission check stop being reachable from nav — the page itself is deleted in Task 12, not here, since Task 1's migrated deals need a working admin page before combos disappears).

- [ ] **Step 4: Write the Deals admin page**

```tsx
// app/admin/deals/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'

interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  is_active: boolean
}

interface Category { id: string; name: string; slug: string }

const TYPE_LABELS: Record<DealType, string> = {
  bogo: 'BOGO',
  bundle: 'Build-a-Bundle',
  fixed_meal: 'Fixed-Price Meal',
  order_discount: 'Order/Category Discount',
}

const EMPTY_CONFIG: Record<DealType, any> = {
  bogo: { buy: { category: '', qty: 1 }, get: { category: '', qty: 1, discount: 'free' } },
  bundle: { groups: [{ label: '', category: '', pick_qty: 1 }], price: 0 },
  fixed_meal: { items: [{ item_id: '', qty: 1 }], price: 0 },
  order_discount: { scope: 'order', discount: { type: 'percent', value: 10 } },
}

export default function DealsAdminPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [creatingType, setCreatingType] = useState<DealType | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/deals').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([d, c]) => { setDeals(d); setCategories(c) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleToggle(id: string, is_active: boolean) {
    const res = await fetch(`/api/admin/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (res.ok) setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, is_active } : d)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE' })
    if (res.ok) setDeals((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleSave(payload: { type: DealType; name: string; config: any }) {
    setError(null)
    const isEdit = Boolean(editing)
    const url = isEdit ? `/api/admin/deals/${editing!.id}` : '/api/admin/deals'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Save failed'); return }
    setEditing(null)
    setCreatingType(null)
    load()
  }

  const formType = editing?.type ?? creatingType

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Deals</h1>
              <p className="text-zinc-400 text-sm">BOGO, bundles, fixed-price meals and order-wide discounts — auto-applied at checkout.</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-red/80 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                <Plus className="w-4 h-4" /> New Deal
              </button>
              <div className="absolute right-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl hidden group-hover:block z-10">
                {(Object.keys(TYPE_LABELS) as DealType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCreatingType(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 first:rounded-t-xl last:rounded-b-xl"
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-zinc-500 text-sm">Loading...</div>
          ) : deals.length === 0 ? (
            <div className="text-zinc-500 text-sm">No deals yet — create one above.</div>
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-red px-2 py-0.5 bg-brand-red/10 rounded">
                        {TYPE_LABELS[deal.type]}
                      </span>
                      {!deal.is_active && <span className="text-xs text-zinc-600">inactive</span>}
                    </div>
                    <p className="text-white font-medium text-sm">{deal.name}</p>
                  </div>
                  <button onClick={() => setEditing(deal)} className="text-zinc-500 hover:text-white p-2">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(deal.id)} className="text-zinc-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(deal.id, !deal.is_active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${deal.is_active ? 'bg-brand-red' : 'bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${deal.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {formType && (
        <DealFormModal
          type={formType}
          categories={categories}
          initial={editing ?? { type: formType, name: '', config: EMPTY_CONFIG[formType], is_active: true } as any}
          error={error}
          onCancel={() => { setEditing(null); setCreatingType(null); setError(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function DealFormModal({ type, categories, initial, error, onCancel, onSave }: {
  type: DealType
  categories: Category[]
  initial: Deal
  error: string | null
  onCancel: () => void
  onSave: (payload: { type: DealType; name: string; config: any }) => void
}) {
  const [name, setName] = useState(initial.name)
  const [config, setConfig] = useState<any>(initial.config)

  function set(path: (string | number)[], value: any) {
    setConfig((prev: any) => {
      const next = structuredClone(prev)
      let cur = next
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]]
      cur[path[path.length - 1]] = value
      return next
    })
  }

  const categoryOptions = (
    <>
      <option value="">— choose category —</option>
      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
    </>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{TYPE_LABELS[type]}</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Deal name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="e.g. Buy 1 Get 1 Free Wings"
            />
          </div>

          {type === 'bogo' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Buy category</label>
                  <select value={config.buy.category} onChange={(e) => set(['buy', 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Buy qty</label>
                  <input type="number" min={1} value={config.buy.qty} onChange={(e) => set(['buy', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Get category</label>
                  <select value={config.get.category} onChange={(e) => set(['get', 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Get qty</label>
                  <input type="number" min={1} value={config.get.qty} onChange={(e) => set(['get', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Discount</label>
                <select
                  value={config.get.discount === 'free' ? 'free' : 'percent'}
                  onChange={(e) => set(['get', 'discount'], e.target.value === 'free' ? 'free' : { percent: 50 })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="free">Free</option>
                  <option value="percent">Percent off</option>
                </select>
                {config.get.discount !== 'free' && (
                  <input
                    type="number" min={1} max={100}
                    value={config.get.discount.percent}
                    onChange={(e) => set(['get', 'discount'], { percent: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mt-2"
                  />
                )}
              </div>
            </>
          )}

          {type === 'bundle' && (
            <>
              {config.groups.map((g: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Label</label>
                    <input value={g.label} onChange={(e) => set(['groups', i, 'label'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                    <select value={g.category} onChange={(e) => set(['groups', i, 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                      {categoryOptions}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Pick qty</label>
                    <input type="number" min={1} value={g.pick_qty} onChange={(e) => set(['groups', i, 'pick_qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => set(['groups'], [...config.groups, { label: '', category: '', pick_qty: 1 }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add group
              </button>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Bundle price (£)</label>
                <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </>
          )}

          {type === 'fixed_meal' && (
            <>
              {config.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Menu item ID</label>
                    <input value={it.item_id} onChange={(e) => set(['items', i, 'item_id'], e.target.value)} placeholder="paste from Menu Manager" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Qty</label>
                    <input type="number" min={1} value={it.qty} onChange={(e) => set(['items', i, 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => set(['items'], [...config.items, { item_id: '', qty: 1 }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add item
              </button>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fixed price (£)</label>
                <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </>
          )}

          {type === 'order_discount' && (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Scope</label>
                <select value={config.scope} onChange={(e) => set(['scope'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="order">Whole order</option>
                  <option value="category">Specific category</option>
                </select>
              </div>
              {config.scope === 'category' && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                  <select value={config.category ?? ''} onChange={(e) => set(['category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Minimum subtotal (£, optional)</label>
                <input type="number" min={0} step="0.01" value={config.min_subtotal ?? ''} onChange={(e) => set(['min_subtotal'], e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Discount type</label>
                  <select value={config.discount.type} onChange={(e) => set(['discount', 'type'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="percent">Percent</option>
                    <option value="amount">Amount (£)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Value</label>
                  <input type="number" min={0} step="0.01" value={config.discount.value} onChange={(e) => set(['discount', 'value'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-zinc-700">
            Cancel
          </button>
          <button
            onClick={() => onSave({ type, name, config })}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-brand-red hover:bg-brand-red/80 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

Sign in as owner, go to `/admin/deals`, create one of each of the 4 types, confirm they list, toggle active/inactive, edit, and delete. Confirm a `staff`-role account without the `Deals` permission does not see the nav link and gets 403 from the API.

- [ ] **Step 6: Commit**

```bash
git add app/admin/staff/page.tsx components/admin/admin-sidebar.tsx app/admin/deals
git commit -m "feat: add admin Deals page with per-type builder forms"
```

---

### Task 5: Public API — active deals + cart quote

**Files:**
- Create: `app/api/deals/active/route.ts`
- Create: `app/api/deals/quote/route.ts`

**Interfaces:**
- Consumes: `matchDeals`, `Deal`, `DealCartItem`, `MenuItemLite` from `@/lib/deal-engine` (Task 2); `supabaseAdmin`.
- Produces: `GET /api/deals/active` → `Deal[]`; `POST /api/deals/quote` (body `{ items: {menu_item_id: string, quantity: number}[] }`) → `{ applied: AppliedDeal[], totalDiscount: number }`. Consumed by Task 6 (checkout), Task 7 (checkout page), Task 8/9 (customer UI).

- [ ] **Step 1: Active deals route**

```ts
// app/api/deals/active/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, type, name, config')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2: Quote route**

```ts
// app/api/deals/quote/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { matchDeals, type Deal, type DealCartItem, type MenuItemLite } from '@/lib/deal-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { items } = (await request.json()) as { items: DealCartItem[] }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ applied: [], totalDiscount: 0 })
  }

  const itemIds = items.map((i) => i.menu_item_id).filter((id): id is string => Boolean(id))
  const [{ data: deals }, { data: menuItems }] = await Promise.all([
    supabaseAdmin.from('deals').select('id, type, name, config, is_active').eq('is_active', true),
    supabaseAdmin.from('menu_items').select('id, price, category, is_available').in('id', itemIds),
  ])

  const menuItemsById = new Map<string, MenuItemLite>(
    (menuItems ?? []).map((m) => [m.id, { id: m.id, price: Number(m.price), category: m.category, is_available: m.is_available }]),
  )

  const result = matchDeals(items, (deals ?? []) as Deal[], menuItemsById)
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
curl -s http://localhost:3000/api/deals/active | python -m json.tool
```

- [ ] **Step 4: Commit**

```bash
git add app/api/deals
git commit -m "feat: add public deals-active and deals-quote endpoints"
```

---

### Task 6: Checkout integration

**Files:**
- Modify: `app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `matchDeals`, `Deal`, `DealCartItem`, `MenuItemLite` from `@/lib/deal-engine` (Task 2).

- [ ] **Step 1: Extend the availability-check query to also fetch category, and fetch active deals**

In `app/api/checkout/route.ts`, the existing availability block (around line 132-163) already does:

```ts
    const itemIdsToCheck = items.map(i => i.menu_item_id).filter((id): id is string => Boolean(id))
    if (itemIdsToCheck.length > 0) {
      const { data: dbItems } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, is_available, sold_out_extras')
        .in('id', itemIdsToCheck)
```

Change the `.select(...)` to also pull `price, category`:

```ts
        .select('id, name, is_available, sold_out_extras, price, category')
```

Immediately after that whole availability-check `if` block (right before `const allComponents = items.flatMap(...)`), add:

```ts
    import { matchDeals, type Deal, type MenuItemLite } from '@/lib/deal-engine'
```

(add this import at the top of the file alongside the other imports, not inline — Next.js requires top-level imports).

- [ ] **Step 2: Compute the deal discount**

Right after the `const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)` line, add:

```ts
    const { data: activeDeals } = await supabaseAdmin
      .from('deals')
      .select('id, type, name, config, is_active')
      .eq('is_active', true)

    const menuItemsById = new Map<string, MenuItemLite>(
      (dbItems ?? []).map((m) => [m.id, { id: m.id, price: Number(m.price), category: m.category, is_available: m.is_available }]),
    )
    const { applied: appliedDeals, totalDiscount: dealsDiscountValue } = matchDeals(
      items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      (activeDeals ?? []) as Deal[],
      menuItemsById,
    )
```

Note: `dbItems` is declared inside the earlier `if (itemIdsToCheck.length > 0)` block's scope — hoist its declaration (`let dbItems: ... [] = []`) to just above that `if` so it's accessible here. Concretely, change:

```ts
    const itemIdsToCheck = items.map(i => i.menu_item_id).filter((id): id is string => Boolean(id))
    if (itemIdsToCheck.length > 0) {
      const { data: dbItems } = await supabaseAdmin
```

to:

```ts
    const itemIdsToCheck = items.map(i => i.menu_item_id).filter((id): id is string => Boolean(id))
    let dbItems: { id: string; name: string; is_available: boolean; sold_out_extras: string[] | null; price: number; category: string }[] = []
    if (itemIdsToCheck.length > 0) {
      const { data } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, is_available, sold_out_extras, price, category')
        .in('id', itemIdsToCheck)
      dbItems = data ?? []
```

and update the two references inside that block (`if (dbItems) {` and `const dbMap = new Map(dbItems.map(...))`) to drop the now-redundant `if (dbItems)` guard (it's always an array now), i.e. change `if (dbItems) {` to nothing (just use `dbItems` directly) and remove the matching closing brace — keep the existing `for (const item of items) { ... }` loop body unchanged, just un-nested one level.

- [ ] **Step 3: Fold into the discount pipeline**

Change:

```ts
    const totalDiscountForStripe = discountAmount + pointsDiscountValue
```

to:

```ts
    const totalDiscountForStripe = discountAmount + pointsDiscountValue + dealsDiscountValue
```

and change:

```ts
    const total = subtotal - discountAmount - pointsDiscountValue + delivery_fee
```

to:

```ts
    const total = subtotal - discountAmount - pointsDiscountValue - dealsDiscountValue + delivery_fee
```

- [ ] **Step 4: Store applied deals on the order**

In the `orders` insert object, add one field:

```ts
        applied_deals:       appliedDeals.length > 0 ? appliedDeals : null,
```

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

Add two items to the cart on `/order` that qualify for a seeded bundle deal (from Task 1's migration), or create a test BOGO deal in `/admin/deals` and add qualifying items. Go through checkout with a test Stripe card. Confirm the Stripe total reflects the deal discount and `SELECT applied_deals FROM orders ORDER BY created_at DESC LIMIT 1;` shows the expected entry.

- [ ] **Step 6: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat: apply deals engine discount in checkout"
```

---

### Task 7: Checkout page — show the deal discount

**Files:**
- Modify: `app/checkout/page.tsx`

**Interfaces:**
- Consumes: `POST /api/deals/quote` (Task 5).

- [ ] **Step 1: Fetch a quote when the cart is known**

Near the existing auto-promo effect (around line 143-162, which does `fetch('/api/auto-apply')`), add a sibling state and effect:

```ts
  const [dealsQuote, setDealsQuote] = useState<{ applied: { deal_id: string; name: string; savings: number }[]; totalDiscount: number }>({ applied: [], totalDiscount: 0 })
```

(declare this alongside the other `useState` calls near the top of the component, e.g. right after `autoPromo`'s declaration).

```ts
  useEffect(() => {
    if (cartItems.length === 0) return
    fetch('/api/deals/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItems.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })) }),
    })
      .then((r) => r.json())
      .then((data) => setDealsQuote(data))
      .catch(() => {})
  }, [cartItems])
```

- [ ] **Step 2: Fold into the displayed total**

Change:

```ts
  const total = subtotal - discount - loyaltyDiscount - autoDiscount + deliveryFee
```

to:

```ts
  const dealsDiscount = dealsQuote.totalDiscount
  const total = subtotal - discount - loyaltyDiscount - autoDiscount - dealsDiscount + deliveryFee
```

- [ ] **Step 3: Display it in the totals block**

In the "Totals" card (around line 677-699), right after the `autoPromo` block, add:

```tsx
          {dealsQuote.applied.map((d) => (
            <div key={d.deal_id} className="flex justify-between text-sm text-emerald-600">
              <span>🎉 {d.name}</span>
              <span>-£{d.savings.toFixed(2)}</span>
            </div>
          ))}
```

- [ ] **Step 4: Manual verification**

Add qualifying items to cart, go to `/checkout`, confirm the "🎉 <name>" line appears with correct savings and the displayed total matches what checkout actually charges (cross-check against Task 6's server total in the network tab response — they must match, since both call the same `matchDeals` function with the same inputs).

- [ ] **Step 5: Commit**

```bash
git add app/checkout/page.tsx
git commit -m "feat: show applied deals on checkout page"
```

---

### Task 8: Shared bundle group picker component

**Files:**
- Create: `components/Deals/BundleGroupPicker.tsx`

**Interfaces:**
- Consumes: nothing beyond props.
- Produces: `export default function BundleGroupPicker(props: { groups: {label: string; category: string; pick_qty: number}[]; price: number; menuItemsByCategory: Record<string, {id: string; name: string; price: number; image_url: string | null}[]>; onComplete: (selections: {item_id: string; category: string}[]) => void })`. Consumed by Task 9 (`/deals` page) and Task 10 (`ItemCustomizerDrawer`).

- [ ] **Step 1: Write the component**

```tsx
// components/Deals/BundleGroupPicker.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'

interface GroupItem { id: string; name: string; price: number; image_url: string | null }
interface Group { label: string; category: string; pick_qty: number }

interface Props {
  groups: Group[]
  price: number
  menuItemsByCategory: Record<string, GroupItem[]>
  onComplete: (selections: { item_id: string; category: string }[]) => void
}

export default function BundleGroupPicker({ groups, price, menuItemsByCategory, onComplete }: Props) {
  const [selected, setSelected] = useState<Record<number, string[]>>({})

  function toggle(groupIdx: number, itemId: string, pickQty: number) {
    setSelected((prev) => {
      const current = prev[groupIdx] ?? []
      if (current.includes(itemId)) {
        return { ...prev, [groupIdx]: current.filter((id) => id !== itemId) }
      }
      const next = pickQty === 1 ? [itemId] : [...current, itemId].slice(-pickQty)
      return { ...prev, [groupIdx]: next }
    })
  }

  const allComplete = groups.every((g, i) => (selected[i] ?? []).length === g.pick_qty)

  function handleAdd() {
    const selections = groups.flatMap((g, i) => (selected[i] ?? []).map((item_id) => ({ item_id, category: g.category })))
    onComplete(selections)
  }

  return (
    <div className="space-y-5">
      {groups.map((group, i) => {
        const picked = selected[i] ?? []
        const items = menuItemsByCategory[group.category] ?? []
        return (
          <div key={group.label + i}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-heading font-semibold text-zinc-900 text-sm">{group.label}</p>
              <span className="text-[11px] font-semibold text-brand-red">{picked.length} of {group.pick_qty} selected</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const isSelected = picked.includes(item.id)
                const disabled = !isSelected && picked.length >= group.pick_qty
                return (
                  <button
                    key={item.id}
                    disabled={disabled}
                    onClick={() => toggle(i, item.id, group.pick_qty)}
                    className={`rounded-xl border-2 overflow-hidden text-left transition-all ${isSelected ? 'border-brand-red bg-brand-red/5' : disabled ? 'border-zinc-100 opacity-40 cursor-not-allowed' : 'border-zinc-100 hover:border-zinc-200'}`}
                  >
                    {item.image_url ? (
                      <div className="relative w-full h-20">
                        <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" />
                      </div>
                    ) : (
                      <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
                    )}
                    <div className="p-2.5 flex items-start justify-between gap-1">
                      <p className={`text-xs font-semibold leading-tight ${isSelected ? 'text-brand-red' : 'text-zinc-800'}`}>{item.name}</p>
                      {isSelected && <Check size={13} className="text-brand-red shrink-0 mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        onClick={handleAdd}
        disabled={!allComplete}
        className={`w-full font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${!allComplete ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'}`}
      >
        <span>{allComplete ? 'Add Bundle to Order' : 'Select all items'}</span>
        {allComplete && <span>£{price.toFixed(2)}</span>}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Deals/BundleGroupPicker.tsx
git commit -m "feat: add shared BundleGroupPicker component"
```

(No standalone test — this is a presentational component wired up and exercised through Tasks 9 and 10's manual verification.)

---

### Task 9: Customer `/deals` page (replaces `/menu/combo`)

**Files:**
- Create: `app/deals/page.tsx`
- Do not touch `app/menu/combo/page.tsx` yet — it is deleted in Task 12.

**Interfaces:**
- Consumes: `GET /api/deals/active` (Task 5), `GET /api/menu-items` (existing), `BundleGroupPicker` (Task 8).

- [ ] **Step 1: Write the page**

```tsx
// app/deals/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BundleGroupPicker from '@/components/Deals/BundleGroupPicker'

interface Deal {
  id: string
  type: 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'
  name: string
  config: any
}

interface MenuItem { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }

interface CartEntry { qty: number; removals: string[]; additions: string[]; extras: { name: string; price: number }[] }

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeBundle, setActiveBundle] = useState<Deal | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/deals/active').then((r) => r.json()),
      fetch('/api/menu-items').then((r) => r.json()),
    ]).then(([d, m]) => { setDeals(d); setMenuItems(m) })
  }, [])

  const menuItemsByCategory: Record<string, MenuItem[]> = {}
  for (const item of menuItems) {
    if (!item.is_available) continue
    ;(menuItemsByCategory[item.category] ??= []).push(item)
  }

  function addItemsToCart(itemIds: string[]) {
    const raw = sessionStorage.getItem('pendingCartEntries')
    const existing: Record<string, CartEntry> = raw ? JSON.parse(raw) : {}
    for (const id of itemIds) {
      existing[id] = existing[id]
        ? { ...existing[id], qty: existing[id].qty + 1 }
        : { qty: 1, removals: [], additions: [], extras: [] }
    }
    sessionStorage.setItem('pendingCartEntries', JSON.stringify(existing))
    router.push('/order?from=deal')
  }

  return (
    <div className="bg-white min-h-screen px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-zinc-900 mb-1">Deals</h1>
      <p className="text-zinc-500 text-sm mb-6">Auto-applied at checkout — no code needed.</p>

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="border border-zinc-100 rounded-2xl p-5">
            <p className="font-heading font-bold text-zinc-900">{deal.name}</p>
            {deal.type === 'bundle' && (
              <button
                onClick={() => setActiveBundle(deal)}
                className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                Build it — £{deal.config.price.toFixed(2)}
              </button>
            )}
            {deal.type === 'fixed_meal' && (
              <button
                onClick={() => addItemsToCart(deal.config.items.flatMap((it: any) => Array(it.qty).fill(it.item_id)))}
                className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                Add to Order — £{deal.config.price.toFixed(2)}
              </button>
            )}
            {(deal.type === 'bogo' || deal.type === 'order_discount') && (
              <p className="mt-2 text-xs text-zinc-400">Automatically applied when you qualify — just order normally.</p>
            )}
          </div>
        ))}
      </div>

      {activeBundle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
            <BundleGroupPicker
              groups={activeBundle.config.groups}
              price={activeBundle.config.price}
              menuItemsByCategory={menuItemsByCategory}
              onComplete={(selections) => {
                addItemsToCart(selections.map((s) => s.item_id))
                setActiveBundle(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Read `pendingCartEntries` on `/order` mount**

This page writes a `pendingCartEntries` sessionStorage key that `/order/page.tsx` doesn't yet read. In `app/order/page.tsx`, find the `useState<Cart>` initializer for the cart (search for `const [cart, setCart] = useState`) and add a one-time effect right after it:

```ts
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingCartEntries')
      if (raw) {
        setCart((prev) => ({ ...prev, ...JSON.parse(raw) }))
        sessionStorage.removeItem('pendingCartEntries')
      }
    } catch {
      // ignore corrupt storage
    }
  }, [])
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Visit `/deals`, confirm all 4 types render sensibly, complete a bundle build, confirm it lands in the `/order` cart with the right items and quantities, and that the checkout page (Task 7) shows it as an applied deal once qualifying.

- [ ] **Step 4: Commit**

```bash
git add app/deals/page.tsx app/order/page.tsx
git commit -m "feat: add customer /deals page, wire pendingCartEntries into /order"
```

---

### Task 10: Rewire ItemCustomizerDrawer + MenuCard meal rows to the new engine

**Files:**
- Modify: `components/Menu/ItemCustomizerDrawer.tsx`
- Modify: `app/order/page.tsx`

**Interfaces:**
- Consumes: `GET /api/deals/active`, `BundleGroupPicker` (Task 8).

This task removes the old `combo_category`/`combo-items`/`combo-discounts`-driven "Make it a Meal" logic and the in-progress "SINGLE / MEAL DEAL" wiring that currently calls those same old endpoints, and replaces both with the new deals engine — while keeping the existing dual-row visual pattern.

- [ ] **Step 1: Replace the meal-mode data fetch and state in `ItemCustomizerDrawer.tsx`**

Remove these existing pieces (all currently present in the file): the `ComboItem` interface, `comboLoading`/`comboItems`/`selectedSize`/`selectedSide`/`selectedDrink`/`discounts`/`comboStep` state, the `useEffect` that fetches `/api/menu/combo-items` and `/api/menu/combo-discounts`, `filteredSides`/`filteredDrinks`/`activeDiscount`/`comboAddPrice`/`mealComplete`, `handleSizeSelect`/`handleSideSelect`/`handleDrinkSelect`, and the three `AccordionSection` blocks for size/side/drink (the `AccordionSection` and `ComboItemCard` helper components can stay — they're generic and no longer used here, but `ComboItemCard` becomes dead code; leave it, `BundleGroupPicker` is a separate component, not a replacement for these two small helpers, so this is not a duplicate).

Add:

```ts
interface BundleDeal {
  id: string
  name: string
  config: { groups: { label: string; category: string; pick_qty: number }[]; price: number }
}
```

Replace the meal-mode `useEffect` with:

```ts
  const [matchingBundle, setMatchingBundle] = useState<BundleDeal | null>(null)
  const [bundleMenuItems, setBundleMenuItems] = useState<Record<string, { id: string; name: string; price: number; image_url: string | null }[]>>({})

  useEffect(() => {
    if (!mealMode) return
    fetch('/api/deals/active')
      .then((r) => r.json())
      .then((deals: { id: string; type: string; name: string; config: any }[]) => {
        const bundle = deals.find((d) => d.type === 'bundle' && d.config.groups.some((g: any) => g.category === item.category)) as BundleDeal | undefined
        if (!bundle) return
        setMatchingBundle(bundle)
        const categories = bundle.config.groups.map((g) => g.category)
        fetch('/api/menu-items')
          .then((r) => r.json())
          .then((all: { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }[]) => {
            const byCategory: Record<string, { id: string; name: string; price: number; image_url: string | null }[]> = {}
            for (const cat of categories) {
              byCategory[cat] = all.filter((m) => m.category === cat && m.is_available)
            }
            setBundleMenuItems(byCategory)
          })
      })
      .catch(() => {})
  }, [mealMode, item.category])
```

- [ ] **Step 2: Replace the meal-mode JSX block**

Replace the whole `{mealMode && ( comboLoading ? ... : <> ...three AccordionSections... </> )}` block with:

```tsx
          {mealMode && (
            matchingBundle ? (
              <div className="px-5 py-4">
                <BundleGroupPicker
                  groups={matchingBundle.config.groups}
                  price={matchingBundle.config.price}
                  menuItemsByCategory={bundleMenuItems}
                  onComplete={(selections) => {
                    onAddToOrder({ item, quantity: qty, removals, additions, extras, notes: notes.trim(), totalPrice: total })
                    selections.forEach((s) => bundleSelectionsRef.current.push(s.item_id))
                    onClose()
                  }}
                />
              </div>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-zinc-400">No meal deal currently available for this item.</div>
            )
          )}
```

Add the import at the top: `import BundleGroupPicker from '@/components/Deals/BundleGroupPicker'`.

Since `BundleGroupPicker`'s own "Add Bundle to Order" button already finalizes the whole bundle (main + sides + drinks) in one action, it replaces the drawer's own footer CTA for this flow — the drawer needs a way to report the bundle's non-drawer items (side/drink) back up to the caller, since the drawer only manages the *current* item. Add a ref-based collector and a `onAddBundleItems` prop:

Update `Props`:

```ts
interface Props {
  item: DrawerItem
  onClose: () => void
  onAddToOrder: (selection: OrderSelection) => void
  onAddBundleItems?: (itemIds: string[]) => void
  initialMealMode?: boolean
}
```

Update the destructure: `export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder, onAddBundleItems, initialMealMode = false }: Props) {` and simplify the `onComplete` handler from Step 2 to:

```tsx
                  onComplete={(selections) => {
                    onAddToOrder({ item, quantity: qty, removals, additions, extras, notes: notes.trim(), totalPrice: total })
                    onAddBundleItems?.(selections.map((s) => s.item_id))
                    onClose()
                  }}
```

(drop the `bundleSelectionsRef` mentioned above — this simpler prop callback replaces it; do not add the ref.)

Remove the "Make it a Meal" toggle's now-unused `isMain` check against `combo_category` — change:

```ts
  const isMain = item.combo_category === 'main'
```

to:

```ts
  const isMain = true
```

with a comment: `// ponytail: every item can offer "Make it a Meal" now — the bundle lookup itself decides whether a matching deal exists; item-type gating was combo_category-specific and no longer applies`. (The toggle still only does something useful once `matchingBundle` resolves; showing it and then saying "No meal deal currently available" for items with no matching bundle is acceptable — simpler than re-deriving which items qualify ahead of time.)

- [ ] **Step 3: Wire `onAddBundleItems` in `app/order/page.tsx`**

Find `onAddToOrder={handleAddToOrder}` on the `<ItemCustomizerDrawer` element and add a sibling prop:

```tsx
          onAddBundleItems={(itemIds) => {
            setCart((p) => {
              const next = { ...p }
              for (const id of itemIds) {
                next[id] = { qty: (next[id]?.qty ?? 0) + 1, removals: [], additions: [], extras: [] }
              }
              return next
            })
          }}
```

- [ ] **Step 4: Replace the old combo-fetch effect and `mealFromPriceFor` in `app/order/page.tsx`**

The existing in-progress `useEffect` (fetching `/api/menu/combo-items` / `/api/menu/combo-discounts`) and `mealFromPriceFor` memo both drive the "MEAL DEAL £x.xx" price shown on the dual-row card. Replace them with a fetch against the new engine:

```ts
  const [activeBundles, setActiveBundles] = useState<{ id: string; config: { groups: { category: string }[]; price: number } }[]>([])

  useEffect(() => {
    fetch('/api/deals/active')
      .then((r) => r.json())
      .then((deals: { id: string; type: string; config: any }[]) => {
        setActiveBundles(deals.filter((d) => d.type === 'bundle'))
      })
      .catch(() => {})
  }, [])

  const mealFromPriceFor = useMemo(() => {
    return (item: MenuItem): number | null => {
      const bundle = activeBundles.find((b) => b.config.groups.some((g) => g.category === item.category))
      return bundle ? bundle.config.price : null
    }
  }, [activeBundles])
```

Delete the `ComboItemLite` interface, the `comboSides`/`comboDrinks`/`mediumDiscount` state, and the old combo-fetch `useEffect` entirely — they're fully superseded.

Change the `showMealRows` condition in `MenuCard` from `item.combo_category === 'main'` to check category membership instead — since any item whose category appears in a bundle's groups can show the row, not just `combo_category === 'main'` items:

```ts
  const showMealRows = qty === 0 && !isSoldOut && mealFromPrice != null
```

(the `mealFromPrice != null` check already encodes "this item's category is part of some active bundle" via `mealFromPriceFor`, so the redundant `combo_category` check is dropped.)

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

On `/order`, find an item whose category matches a seeded bundle group (e.g. a chicken item after Task 1's migration), confirm the SINGLE/MEAL DEAL dual-row card shows with the bundle's price, click MEAL DEAL, confirm the drawer opens with the bundle group picker, complete it, confirm all items land in cart, and confirm checkout (Task 6/7) auto-applies the bundle discount.

- [ ] **Step 6: Commit**

```bash
git add components/Menu/ItemCustomizerDrawer.tsx app/order/page.tsx
git commit -m "feat: rewire meal-deal UI from legacy combo system to deals engine"
```

---

### Task 11: Show applied deals on receipts and account order history

**Files:**
- Modify: `app/api/admin/receipts/route.ts` (select `applied_deals`)
- Modify: `components/admin/receipts/types.ts` (add `applied_deals` to `AdminReceiptOrder`)
- Modify: `components/admin/receipts/ReceiptDrawer.tsx`
- Modify: `app/account/page.tsx`

**Interfaces:**
- Consumes: `orders.applied_deals` (Task 1), already-selected order rows in each file.

- [ ] **Step 1: Admin receipts select + type**

In `app/api/admin/receipts/route.ts`, in the `buildQuery` select string, add `applied_deals` next to the existing `promo_code_used, discount_applied,`.

In `components/admin/receipts/types.ts`, add to `AdminReceiptOrder`:

```ts
  applied_deals: { deal_id: string; name: string; type: string; savings: number }[] | null
```

- [ ] **Step 2: Admin ReceiptDrawer display**

In `components/admin/receipts/ReceiptDrawer.tsx`, right after the existing `{order.discount_applied > 0 && (...)}` block (around line 146-152), add:

```tsx
            {(order.applied_deals ?? []).map((d) => (
              <TotalRow key={d.deal_id} k={`🎉 ${d.name}`} v={`−£${d.savings.toFixed(2)}`} green />
            ))}
```

- [ ] **Step 3: Account page — select and display**

In `app/account/page.tsx`, add `applied_deals` to the `ORDER_SELECT` string (next to `promo_code_used, discount_applied,`), and to the `Order` interface add:

```ts
  applied_deals: { deal_id: string; name: string; type: string; savings: number }[] | null
```

In `OrderCard`, right after the existing `{order.promo_code_used && ... }` badge block (around line 229-233), add:

```tsx
          {(order.applied_deals ?? []).map((d) => (
            <span key={d.deal_id} className="ml-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
              🎉 {d.name} (−£{d.savings.toFixed(2)})
            </span>
          ))}
```

In the printed-receipt HTML builder (around line 380-414), add a row per applied deal right after the existing discount row:

```ts
    const dealRows = (order.applied_deals ?? [])
      .map((d) => `<tr><td style="padding:4px 0;color:#16a34a">🎉 ${d.name}</td><td style="text-align:right;color:#16a34a">−£${d.savings.toFixed(2)}</td></tr>`)
      .join('')
```

and splice `${dealRows}` into the template string right after the existing `${discount > 0 ? ... : ''}` line.

- [ ] **Step 4: Manual verification**

Place a test order that triggers a deal, then check `/admin/receipts` (open its drawer) and `/account` (order history) both show the 🎉 line with correct name/amount, and the printed receipt includes it too.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/receipts/route.ts components/admin/receipts/types.ts components/admin/receipts/ReceiptDrawer.tsx app/account/page.tsx
git commit -m "feat: display applied deals on receipts and account order history"
```

---

### Task 12: Remove the legacy combo system

**Do this task only after Tasks 1-11 are live and manually verified** — it is destructive (deletes files and drops no data, but removes the only UI path to the old system).

**Files:**
- Delete: `app/menu/combo/page.tsx` and its directory
- Delete: `app/api/menu/combo-items/route.ts`, `app/api/menu/combo-discounts/route.ts`
- Delete: `app/api/admin/combo-discounts/route.ts`, `app/api/admin/combo-discounts/[id]/route.ts`
- Delete: `app/admin/combos/page.tsx`, `app/admin/combos/layout.tsx`
- Modify: `app/admin/staff/page.tsx` (remove any lingering combos-only permission if one existed separately from `MenuManager` — check first, the combos admin route used an inline `Menu`/`admin`/`owner` check rather than the `ALL_PERMISSIONS` list, so there is likely nothing to remove here beyond what Task 4 already did)

**Interfaces:** none — purely deletions plus confirming nothing still imports the deleted files.

- [ ] **Step 1: Confirm nothing still references the old routes**

```bash
grep -rn "combo-items\|combo-discounts\|/menu/combo\|/admin/combos" app components --include="*.tsx" --include="*.ts"
```

Expected: no matches (Task 9 and Task 10 already removed the only call sites). If anything remains, stop and fix it before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm -r app/menu/combo app/api/menu/combo-items app/api/menu/combo-discounts app/api/admin/combo-discounts app/admin/combos
```

- [ ] **Step 3: Run the full test suite and a production build**

```bash
npm test
npm run build
```

Expected: both succeed with no references to the deleted files.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove legacy combo-meal system, superseded by the deals engine"
```

---

## Self-Review Notes

- **Spec coverage:** §2 data model → Task 1; §3 engine → Task 2; §4 API routes → Tasks 3, 5; §5 checkout → Task 6; §6 customer UI → Tasks 8, 9, 10; §6 kitchen/receipts line → Task 11 (scoped down to receipts + account history, the only two surfaces that render `discount_applied` today — kitchen tickets and `/track/[id]` do not show pricing at all currently, so no task invents a new display surface there); §9 files list → covered across Tasks 1-12; §10 out of scope → respected (no DROP COLUMN, no date windows, no cross-group constraints).
- **Type consistency check performed:** `AppliedDeal`/`Deal`/`DealCartItem`/`MenuItemLite` names and shapes are identical across Task 2 (definition), Task 5 (quote route), Task 6 (checkout route), Task 9/10 (consume the JSON shape, not the TS types, since they're client components).
- **Correction applied during planning:** the original spec draft used `category_id`; verified against the live schema (`menu_items.category` is a bare text column, no FK) and corrected both the spec and this plan to use plain category-slug strings throughout.
