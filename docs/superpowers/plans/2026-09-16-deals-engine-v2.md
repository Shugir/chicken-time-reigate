# Deals Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move deal↔product association from implicit product-side tagging (`combo_category`/`size_tier`) to explicit admin-driven slot builder in the Deals panel, and give customers a "Deal to Cart" path (badge + slot picker) instead of relying only on checkout-time auto-detection.

**Architecture:** `deals.config.groups[i]` changes from `{label, category, pick_qty}` to `{label, min_qty, max_qty, item_ids}`. The matching engine (`lib/deal-engine.ts`) keeps its existing greedy best-marginal-savings loop, just matching bundle groups against explicit `item_ids` and consuming exactly `min_qty` per group (not up to `max_qty` — see Task 1 for why). Deal-picked items land as ordinary cart lines through the existing `handleAddToOrder` path; no new cart-item shape.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + Storage), Vitest, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-16-deals-engine-v2-design.md`

## Global Constraints

- Bundle engine consumption/savings is pegged to `min_qty`, never `max_qty` (closes the discount-inflation bug found in architect review — see spec's engine section).
- `fixed_meal` deal type: dormant enum value stays in Postgres; every app-side code path for it is deleted, not merely hidden.
- `combo_category`/`size_tier` columns: **all app-code read/write sites must be updated before the DROP COLUMN migration runs** (Task 3 before Task 4) — this is the live Supabase project (`nxvtfcfwvqfihqxmtgpc`), not a staged environment.
- The deal-membership badge is labeled `DEAL`, never `OFFER` — `OFFER` is already used for `compare_at_price` price-slash promos in `MenuCard` (`app/order/page.tsx`); reusing it would collide with that unrelated feature.
- Reuse existing UI/upload plumbing — don't build a second image upload route, don't build a new dual-button row where `MenuCard`'s existing SINGLE/MEAL DEAL row can be repointed instead.
- Migrations apply via `npx supabase db query --linked --file <path>` (the same method used for this session's RLS fix) — `supabase db push` is broken against this project's migration history and out of scope to repair here.

---

### Task 1: Engine — min_qty-pegged bundle consumption + isDealLive

**Files:**
- Modify: `lib/deal-engine.ts`
- Test: `lib/deal-engine.test.ts`

**Interfaces:**
- Produces: `BundleConfig { groups: { label: string; min_qty: number; max_qty: number; item_ids: string[] }[]; price: number }`, `export function isDealLive(deal: { is_active: boolean; available_from?: string | null; available_until?: string | null }, now?: Date): boolean`
- Consumes: nothing new (pure function changes within an already-standalone module)

- [ ] **Step 1: Write the failing tests for the new bundle shape**

Replace the two `describe('matchDeals — bundle', ...)` tests in `lib/deal-engine.test.ts` (currently using `category`/`pick_qty`) with:

```ts
describe('matchDeals — bundle', () => {
  it('consumes exactly min_qty of the highest-priced qualifying items per group', () => {
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
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['chicken-a', 'chicken-b'] },
          { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['side-a'] },
          { label: 'Drink', min_qty: 1, max_qty: 1, item_ids: ['drink-a'] },
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
    // Picks chicken-b (£8, pricier main) into the bundle: 8+2+1.5=11.5 - 9 = 2.5 savings
    expect(result.totalDiscount).toBe(2.5)
  })

  it('does not apply when a group has too few qualifying items for min_qty', () => {
    const menuItems = menuMap([{ id: 'chicken-a', price: 6, category: 'chicken', is_available: true }])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['chicken-a'] },
          { label: 'Side', min_qty: 1, max_qty: 1, item_ids: ['side-a'] },
        ],
        price: 5,
      },
    }]
    const cart: DealCartItem[] = [{ menu_item_id: 'chicken-a', quantity: 1 }]
    const result = matchDeals(cart, deals, menuItems)
    expect(result.applied).toHaveLength(0)
  })

  it('regression: never consumes more than min_qty even when max_qty and cart supply allow more', () => {
    // This is the discount-inflation bug the architect review caught: with a
    // fixed bundle price, consuming more units always increases savings, so
    // an up-to-max_qty engine would always grab max_qty when available —
    // awarding a bigger discount than the customer chose in the picker.
    const menuItems = menuMap([
      { id: 'side-a', price: 3, category: 'sides', is_available: true },
      { id: 'side-b', price: 4, category: 'sides', is_available: true },
      { id: 'side-c', price: 5, category: 'sides', is_available: true },
      { id: 'main-a', price: 10, category: 'chicken', is_available: true },
    ])
    const deals: Deal[] = [{
      id: 'd1', type: 'bundle', name: 'Meal Deal', is_active: true,
      config: {
        groups: [
          { label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['main-a'] },
          { label: 'Side', min_qty: 1, max_qty: 3, item_ids: ['side-a', 'side-b', 'side-c'] },
        ],
        price: 12,
      },
    }]
    // Cart has all 3 sides available — an up-to-max engine would consume all 3.
    const cart: DealCartItem[] = [
      { menu_item_id: 'main-a', quantity: 1 },
      { menu_item_id: 'side-a', quantity: 1 },
      { menu_item_id: 'side-b', quantity: 1 },
      { menu_item_id: 'side-c', quantity: 1 },
    ]
    const result = matchDeals(cart, deals, menuItems)
    // Correct: consumes only min_qty=1 side, the priciest one (side-c, £5).
    // 10 + 5 = 15 - 12 = 3 savings. (An up-to-max bug would consume all 3
    // sides: 10+3+4+5=22-12=10 savings — wrong.)
    expect(result.totalDiscount).toBe(3)
  })
})
```

Delete the entire `describe('matchDeals — fixed_meal', ...)` block.

Add a new describe block at the end of the file, before the closing of the last existing block:

```ts
describe('isDealLive', () => {
  it('is live when is_active and no schedule window is set', () => {
    expect(isDealLive({ is_active: true, available_from: null, available_until: null })).toBe(true)
  })

  it('is not live when is_active is false, regardless of schedule', () => {
    expect(isDealLive({ is_active: false, available_from: null, available_until: null })).toBe(false)
  })

  it('is live when now is within the schedule window', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: '2026-06-01T00:00:00Z',
      available_until: '2026-06-30T23:59:59Z',
    }, now)).toBe(true)
  })

  it('is not live before available_from', () => {
    const now = new Date('2026-05-01T00:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: '2026-06-01T00:00:00Z',
      available_until: null,
    }, now)).toBe(false)
  })

  it('is not live after available_until', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    expect(isDealLive({
      is_active: true,
      available_from: null,
      available_until: '2026-06-30T23:59:59Z',
    }, now)).toBe(false)
  })
})
```

Update the import line at the top of the test file:

```ts
import { matchDeals, isDealLive, type Deal, type MenuItemLite, type DealCartItem } from './deal-engine'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd chicken-time-reigate && npx vitest run lib/deal-engine.test.ts`
Expected: FAIL — `isDealLive` is not exported, and the bundle tests fail because `evaluateItemDeal` still reads `group.category`/`group.pick_qty` which are `undefined` on the new fixtures.

- [ ] **Step 3: Update `BundleConfig` and the bundle branch in `evaluateItemDeal`**

In `lib/deal-engine.ts`, replace:

```ts
interface BundleConfig {
  groups: { label: string; category: string; pick_qty: number }[]
  price: number
}
```

with:

```ts
interface BundleConfig {
  groups: { label: string; min_qty: number; max_qty: number; item_ids: string[] }[]
  price: number
}
```

Replace the bundle branch inside `evaluateItemDeal`:

```ts
  if (deal.type === 'bundle') {
    const cfg = deal.config as BundleConfig
    const consume: Unit[] = []
    let sum = 0
    for (const group of cfg.groups) {
      const pool = available
        .filter((u) => !consume.includes(u) && normCategory(u.category) === normCategory(group.category))
        .sort((a, b) => b.price - a.price)
      if (pool.length < group.pick_qty) return null
      const picked = pool.slice(0, group.pick_qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume, lock: [] } : null
  }
```

with:

```ts
  if (deal.type === 'bundle') {
    const cfg = deal.config as BundleConfig
    const consume: Unit[] = []
    let sum = 0
    for (const group of cfg.groups) {
      const pool = available
        .filter((u) => !consume.includes(u) && group.item_ids.includes(u.menu_item_id))
        .sort((a, b) => b.price - a.price)
      if (pool.length < group.min_qty) return null
      // Consume exactly min_qty, never up to max_qty: price is fixed per
      // bundle regardless of quantity consumed within range, so consuming
      // more would strictly increase savings with no ceiling — max_qty is
      // a DealSlotPicker-only UX constraint, not something the automatic
      // matcher should reward.
      const picked = pool.slice(0, group.min_qty)
      picked.forEach((u) => { consume.push(u); sum += u.price })
    }
    const savings = sum - cfg.price
    return savings > 0 ? { savings, consume, lock: [] } : null
  }
```

- [ ] **Step 4: Delete the `fixed_meal` branch and type**

Delete the `FixedMealConfig` interface entirely, and delete this block from `evaluateItemDeal`:

```ts
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
    return savings > 0 ? { savings, consume, lock: [] } : null
  }
```

Update `export type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'` to `export type DealType = 'bogo' | 'bundle' | 'order_discount'`.

- [ ] **Step 5: Add `isDealLive`**

Add near the top of `lib/deal-engine.ts`, after the `round2` helper:

```ts
export function isDealLive(
  deal: { is_active: boolean; available_from?: string | null; available_until?: string | null },
  now: Date = new Date(),
): boolean {
  if (!deal.is_active) return false
  if (deal.available_from && now < new Date(deal.available_from)) return false
  if (deal.available_until && now > new Date(deal.available_until)) return false
  return true
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd chicken-time-reigate && npx vitest run lib/deal-engine.test.ts`
Expected: PASS, all tests including the 3 new bundle tests and the 5 new `isDealLive` tests.

- [ ] **Step 7: Typecheck**

Run: `cd chicken-time-reigate && npx tsc --noEmit`
Expected: no new errors from `lib/deal-engine.ts` (other files still referencing the old bundle/fixed_meal shapes will error — that's expected, they're fixed in later tasks; confirm the *only* new errors are in files this plan touches later: `app/api/admin/deals/route.ts`, `app/admin/deals/page.tsx`, `components/Deals/BundleGroupPicker.tsx`, `app/deals/page.tsx`, `components/Menu/ItemCustomizerDrawer.tsx`).

- [ ] **Step 8: Commit**

```bash
git add lib/deal-engine.ts lib/deal-engine.test.ts
git commit -m "feat(deals): bundle engine matches item_ids, pegs consumption to min_qty

Replaces category/pick_qty matching with explicit item_ids and a
min_qty/max_qty range. Consumption and savings are pegged to min_qty
only -- with a fixed bundle price, consuming more units always
increases savings with no ceiling, so an up-to-max_qty matcher would
always grab max_qty whenever available, silently awarding a bigger
discount than the customer chose in the slot picker. max_qty is a
picker-only UX constraint from here on.

Also retires the fixed_meal deal type (no live rows; superseded by a
single-item bundle group) and adds isDealLive() for deal scheduling."
```

---

### Task 2: Migration A — additive columns on `deals`

**Files:**
- Create: `supabase/migrations/20260917a_deals_v2_columns.sql`

**Interfaces:**
- Produces: `deals.available_from`, `deals.available_until`, `deals.image_url`, `deals.custom_label` columns (all nullable, no default — purely additive, zero risk to existing rows/queries).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260917a_deals_v2_columns.sql

ALTER TABLE deals
  ADD COLUMN available_from  TIMESTAMPTZ,
  ADD COLUMN available_until TIMESTAMPTZ,
  ADD COLUMN image_url       TEXT,
  ADD COLUMN custom_label    TEXT;
```

- [ ] **Step 2: Apply it to the linked project**

Run: `cd chicken-time-reigate && npx supabase db query --linked --file supabase/migrations/20260917a_deals_v2_columns.sql`
Expected: empty `rows: []` success response (same shape as the RLS fix migration applied earlier this session).

- [ ] **Step 3: Verify**

Run: `cd chicken-time-reigate && npx supabase db query --linked "select column_name from information_schema.columns where table_name = 'deals' order by column_name;"`
Expected: output includes `available_from`, `available_until`, `custom_label`, `image_url` alongside the existing columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260917a_deals_v2_columns.sql
git commit -m "feat(deals): add scheduling, image, and custom label columns"
```

---

### Task 3: Strip `combo_category`/`size_tier` from all app-code read/write sites

**Files:**
- Modify: `app/api/menu-items/route.ts`
- Modify: `app/api/admin/menu-items/[id]/route.ts`
- Modify: `app/api/checkout/route.ts`
- Modify: `app/order/page.tsx`
- Modify: `components/Menu/ItemCustomizerDrawer.tsx`

**Interfaces:**
- Produces: none of these files reference `combo_category`/`size_tier` anywhere after this task — a precondition for Task 4's `DROP COLUMN` to be safe.

This task has no new tests of its own (removing dead fields from existing types/queries) — verified by typecheck + a grep sweep + the existing test suite still passing.

- [ ] **Step 1: `app/api/menu-items/route.ts`**

This is the blocker the researcher/architect review both flagged: this public route backs `/order`, `/deals`, and `ItemCustomizerDrawer`, and its `.select()` explicitly names these columns.

Change:
```ts
    .select('id, name, description, price, compare_at_price, image_url, category, is_available, sold_out_extras, custom_options, extras, removals, additions, dietary_flags, allergens, combo_category, size_tier')
```
to:
```ts
    .select('id, name, description, price, compare_at_price, image_url, category, is_available, sold_out_extras, custom_options, extras, removals, additions, dietary_flags, allergens')
```

- [ ] **Step 2: `app/api/admin/menu-items/[id]/route.ts`**

Change the `PATCHABLE` set:
```ts
  const PATCHABLE = new Set([
    'name', 'description', 'price', 'compare_at_price', 'image_url',
    'category', 'is_available', 'sold_out_extras', 'extras', 'removals',
    'additions', 'dietary_flags', 'allergens', 'combo_category', 'size_tier',
  ])
```
to:
```ts
  const PATCHABLE = new Set([
    'name', 'description', 'price', 'compare_at_price', 'image_url',
    'category', 'is_available', 'sold_out_extras', 'extras', 'removals',
    'additions', 'dietary_flags', 'allergens',
  ])
```

(`app/api/admin/menu-items/route.ts`'s GET uses `select('*')` — no edit needed there, it will simply stop returning these fields once the columns are dropped in Task 4. Its POST payload already excludes them.)

- [ ] **Step 3: `app/api/checkout/route.ts`**

Delete the now-unused `ComboComponent` interface and the `combo_components` field it's only used for tracking display metadata on, and its type reference on `CartItem`:

```ts
interface ComboComponent {
  id:        string
  name:      string
  category:  'main' | 'side' | 'drink'
  size_tier: 'regular' | 'large'
}
```

Remove this interface. Remove the `combo_components?: ComboComponent[]` line from `CartItem`. Remove the two places that read/write `combo_components`:

```ts
    const allComponents = items.flatMap(i => i.combo_components ?? [])
    const componentIds = [...new Set(allComponents.map(c => c.id))]
    if (componentIds.length > 0) {
      const { data: dbComponents } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, is_available')
        .in('id', componentIds)
      if (dbComponents) {
        const compMap = new Map(dbComponents.map(r => [r.id, r]))
        for (const comp of allComponents) {
          const db = compMap.get(comp.id)
          if (!db) continue
          if (!db.is_available) {
            return NextResponse.json(
              { error: `Sorry, ${db.name} just sold out. Please update your cart to continue.` },
              { status: 400 },
            )
          }
        }
      }
    }
```

Delete this whole block — deal-bundle items are now ordinary cart lines already covered by the existing `itemIdsToCheck`/`dbItems` availability check earlier in the same function (lines 134-164), so this was solely the old combo system's separate availability check and is now fully redundant.

Also remove the `combo_components: item.combo_components ?? null,` line from the `order_items` insert payload, and remove `combo_components` from the `order_items` table write shape reference — leave the `order_items` DB column alone (out of scope; unused columns aren't a correctness risk, just don't write to it anymore).

- [ ] **Step 4: `app/order/page.tsx`**

Remove from the `MenuItem` type:
```ts
  combo_category?: 'main' | 'side' | 'drink' | null
  size_tier?: 'regular' | 'large' | null
```

Remove from the `DbMenuItem` interface:
```ts
  combo_category: 'main' | 'side' | 'drink' | null
  size_tier: 'regular' | 'large' | null
```

Remove from `dbToMenuItem`:
```ts
    combo_category: item.combo_category ?? null,
    size_tier: item.size_tier ?? null,
```

(Task 9 handles the rest of this file's deal-related wiring — `mealFromPriceFor`, `openMealDrawer`, the `DEAL` badge — separately, since that's new behavior, not dead-field removal.)

- [ ] **Step 5: `components/Menu/ItemCustomizerDrawer.tsx`**

Remove from the `ComboItem` interface:
```ts
  size_tier: 'regular' | 'large' | null
```

Remove from the `DrawerItem` type:
```ts
  combo_category?: 'main' | 'side' | 'drink' | null
```

(The rest of this file's "Make it a Meal" block is removed in Task 9, alongside the `ComboItem`/`ComboItemCard` cleanup that block's removal makes fully dead.)

- [ ] **Step 6: Grep sweep to confirm nothing was missed**

Run: `cd chicken-time-reigate && grep -rn "combo_category\|size_tier" --include="*.ts" --include="*.tsx" app lib components`
Expected: no matches (the migration in `supabase/migrations/` is expected to still mention them historically — that's fine, only `app`/`lib`/`components` matter here).

- [ ] **Step 7: Typecheck and run full test suite**

Run: `cd chicken-time-reigate && npx tsc --noEmit && npx vitest run`
Expected: no errors related to `combo_category`/`size_tier`/`combo_components`/`ComboComponent`. Remaining errors (if any) should only be in files Task 1 already touched that later tasks still need to fix (`BundleGroupPicker.tsx`, `app/admin/deals/page.tsx`, `app/api/admin/deals/route.ts`, `app/deals/page.tsx`) — confirm the error list matches that expectation, not new ones.

- [ ] **Step 8: Commit**

```bash
git add app/api/menu-items/route.ts app/api/admin/menu-items/[id]/route.ts app/api/checkout/route.ts app/order/page.tsx components/Menu/ItemCustomizerDrawer.tsx
git commit -m "refactor(menu): remove combo_category/size_tier read/write sites

Precondition for dropping these columns (next commit) -- the public
menu-items API in particular would hard-fail every request the moment
the columns are gone if this weren't done first."
```

---

### Task 4: Migration B — backfill bundle groups + drop `combo_category`/`size_tier`

**Files:**
- Create: `supabase/migrations/20260917b_deals_v2_backfill_and_drop.sql`

**Interfaces:**
- Consumes: `isDealLive`/new bundle shape from Task 1 (must be committed/live before this runs, since it rewrites live bundle rows into the new shape), Task 3 complete (no app code left selecting the columns this drops).
- Produces: live `deals` bundle rows in `{label, min_qty, max_qty, item_ids}` shape; `menu_items` no longer has `combo_category`/`size_tier`.

- [ ] **Step 1: Inspect what the backfill will resolve, before running it**

Run this read-only query first to sanity-check the live data (per the spec's "Migration risk" section):

```bash
cd chicken-time-reigate && npx supabase db query --linked "select id, name, config->'groups' as groups from deals where type = 'bundle';"
```

Expected: shows the 2 live bundle deals (Medium/Large Meal Deal) with their current `{label, category, pick_qty}` groups — note the `category` values so you can eyeball the backfill's `item_ids` resolution afterward.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20260917b_deals_v2_backfill_and_drop.sql

-- Migrate live bundle deals from {label, category, pick_qty} groups to
-- {label, min_qty, max_qty, item_ids}. item_ids resolved from current
-- menu_items.category membership at migration time -- a snapshot; future
-- menu changes no longer auto-affect these deals, which is the point
-- (assignment is now explicit, done in the admin slot builder).
DO $$
DECLARE
  deal RECORD;
  new_groups JSONB;
  grp JSONB;
  ids JSONB;
BEGIN
  FOR deal IN SELECT id, config FROM deals WHERE type = 'bundle' LOOP
    new_groups := '[]'::jsonb;
    FOR grp IN SELECT * FROM jsonb_array_elements(deal.config->'groups') LOOP
      SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO ids
        FROM menu_items WHERE category = (grp->>'category');
      new_groups := new_groups || jsonb_build_array(jsonb_build_object(
        'label', grp->>'label',
        'min_qty', (grp->>'pick_qty')::int,
        'max_qty', (grp->>'pick_qty')::int,
        'item_ids', ids
      ));
    END LOOP;
    UPDATE deals SET config = jsonb_set(config, '{groups}', new_groups) WHERE id = deal.id;
  END LOOP;
END $$;

ALTER TABLE menu_items DROP COLUMN combo_category;
ALTER TABLE menu_items DROP COLUMN size_tier;
```

- [ ] **Step 3: Apply it**

Run: `cd chicken-time-reigate && npx supabase db query --linked --file supabase/migrations/20260917b_deals_v2_backfill_and_drop.sql`
Expected: empty `rows: []` success response.

- [ ] **Step 4: Verify the backfill**

Run: `cd chicken-time-reigate && npx supabase db query --linked "select id, name, config->'groups' as groups from deals where type = 'bundle';"`
Expected: each group now has `label`, `min_qty`, `max_qty` (both equal to the old `pick_qty`), and a non-empty `item_ids` array. If any group's `item_ids` is empty, note which deal — it won't match anything until fixed in the admin slot builder (Task 6), which is an acceptable temporary state per the spec, not a data-loss risk.

Run: `cd chicken-time-reigate && npx supabase db query --linked "select column_name from information_schema.columns where table_name = 'menu_items' and column_name in ('combo_category', 'size_tier');"`
Expected: empty result — columns are gone.

- [ ] **Step 5: Smoke-test the running app**

Run: `cd chicken-time-reigate && npm run dev` (if not already running), then load `/order` in a browser and confirm the menu grid still loads with no console errors (this exercises `app/api/menu-items` — the route Task 3 fixed).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260917b_deals_v2_backfill_and_drop.sql
git commit -m "feat(deals): backfill bundle groups to item_ids shape, drop combo_category/size_tier

Live Medium/Large Meal Deal bundles migrated in place. menu_items no
longer carries product-side deal tagging -- deal-product association
is now explicit, done from the admin deals panel."
```

---

### Task 5: Admin API — `app/api/admin/deals/route.ts`

**Files:**
- Modify: `app/api/admin/deals/route.ts`
- Modify: `app/api/admin/deals/[id]/route.ts`

**Interfaces:**
- Consumes: `BundleConfig` shape from Task 1.
- Produces: `POST`/`PATCH` on `/api/admin/deals` accept `custom_label`, `available_from`, `available_until`, `image_url` as top-level fields alongside `type`/`name`/`config`/`is_active`.

- [ ] **Step 1: Update `VALID_TYPES` and `validateConfig`'s bundle case**

In `app/api/admin/deals/route.ts`, change:
```ts
const VALID_TYPES = ['bogo', 'bundle', 'fixed_meal', 'order_discount']
```
to:
```ts
const VALID_TYPES = ['bogo', 'bundle', 'order_discount']
```

Replace the bundle validation block:
```ts
  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
    for (let i = 0; i < c.groups.length; i++) {
      const group = c.groups[i]
      if (!isPlainObject(group)) return `bundle group ${i} is not an object`
      if (typeof group.label !== 'string' || !group.label.trim()) return `bundle group ${i} is missing a label`
      if (typeof group.category !== 'string' || !group.category.trim()) return `bundle group ${i} is missing a category`
      if (typeof group.pick_qty !== 'number' || group.pick_qty <= 0) return `bundle group ${i} pick_qty must be a positive number`
    }
  }
```
with:
```ts
  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
    for (let i = 0; i < c.groups.length; i++) {
      const group = c.groups[i]
      if (!isPlainObject(group)) return `bundle group ${i} is not an object`
      if (typeof group.label !== 'string' || !group.label.trim()) return `bundle group ${i} is missing a label`
      if (typeof group.min_qty !== 'number' || group.min_qty < 0) return `bundle group ${i} min_qty must be a non-negative number`
      if (typeof group.max_qty !== 'number' || group.max_qty < group.min_qty) return `bundle group ${i} max_qty must be a number >= min_qty`
      if (!Array.isArray(group.item_ids) || group.item_ids.length === 0 || !group.item_ids.every((id: unknown) => typeof id === 'string')) {
        return `bundle group ${i} requires a non-empty item_ids array of strings`
      }
    }
  }
```

Delete the entire `if (type === 'fixed_meal') { ... }` validation block.

- [ ] **Step 2: Accept the new top-level fields on create/update**

In the `POST` handler, change:
```ts
  const { type, name, config, is_active = true } = await request.json()
```
to:
```ts
  const { type, name, config, is_active = true, custom_label, available_from, available_until, image_url } = await request.json()
```

and the insert:
```ts
  const { data, error } = await supabaseAdmin
    .from('deals')
    .insert({ type, name: name.trim(), config, is_active })
    .select()
    .single()
```
to:
```ts
  const { data, error } = await supabaseAdmin
    .from('deals')
    .insert({
      type, name: name.trim(), config, is_active,
      custom_label: custom_label?.trim() || null,
      available_from: available_from || null,
      available_until: available_until || null,
      image_url: image_url || null,
    })
    .select()
    .single()
```

- [ ] **Step 3: Same for the PATCH route**

Read `app/api/admin/deals/[id]/route.ts` first to see its current PATCH body handling, then apply the equivalent change: accept `custom_label`, `available_from`, `available_until`, `image_url` in its destructured body and include them in the `.update()` payload the same way as Step 2 (only the fields actually present in the request body, so partial updates from the admin form's edit path don't clobber unrelated fields — check whether the existing PATCH already does a filtered partial update like `app/api/admin/menu-items/[id]/route.ts`'s `PATCHABLE` pattern, and follow whatever convention is already there).

- [ ] **Step 4: Typecheck**

Run: `cd chicken-time-reigate && npx tsc --noEmit`
Expected: no errors in `app/api/admin/deals/route.ts` or `app/api/admin/deals/[id]/route.ts`. (Other files still pending later tasks may still error.)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/deals/route.ts "app/api/admin/deals/[id]/route.ts"
git commit -m "feat(deals): admin API validates v2 bundle shape, accepts schedule/image/label"
```

---

### Task 6: Admin Deals panel UI

**Files:**
- Modify: `app/admin/deals/page.tsx`

**Interfaces:**
- Consumes: `/api/admin/deals` (Task 5), `/api/admin/menu-items` (existing, `select('*')`), `/api/admin/menu/upload` (existing, multipart → `{url}`), `/api/categories` (existing).

- [ ] **Step 1: Drop `fixed_meal` from type labels/empty config**

Change:
```ts
type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'
```
to:
```ts
type DealType = 'bogo' | 'bundle' | 'order_discount'
```

Change:
```ts
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
```
to:
```ts
const TYPE_LABELS: Record<DealType, string> = {
  bogo: 'BOGO',
  bundle: 'Build-a-Bundle',
  order_discount: 'Order/Category Discount',
}

const EMPTY_CONFIG: Record<DealType, any> = {
  bogo: { buy: { category: '', qty: 1 }, get: { category: '', qty: 1, discount: 'free' } },
  bundle: { groups: [{ label: '', min_qty: 1, max_qty: 1, item_ids: [] }], price: 0 },
  order_discount: { scope: 'order', discount: { type: 'percent', value: 10 } },
}
```

- [ ] **Step 2: Add the `Deal` interface's new top-level fields and fetch menu items alongside categories**

Change:
```ts
interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  is_active: boolean
}
```
to:
```ts
interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  is_active: boolean
  custom_label: string | null
  available_from: string | null
  available_until: string | null
  image_url: string | null
}

interface MenuItemOption { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }
```

In the `DealsAdminPage` component, change the `load()` function:
```ts
  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/deals').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([d, c]) => { setDeals(d); setCategories(c) })
      .finally(() => setLoading(false))
  }
```
to:
```ts
  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/deals').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/admin/menu-items').then((r) => r.json()),
    ])
      .then(([d, c, m]) => { setDeals(d); setCategories(c); setMenuItems(m) })
      .finally(() => setLoading(false))
  }
```

Add state alongside the existing `useState` calls:
```ts
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
```

Pass `menuItems` through to `DealFormModal` in its render call (add `menuItems={menuItems}` prop next to the existing `categories={categories}`).

- [ ] **Step 3: Rewrite the bundle section of `DealFormModal` with the slot editor**

Update the `DealFormModal` function signature to accept `menuItems`:
```ts
function DealFormModal({ type, categories, menuItems, initial, error, onCancel, onSave }: {
  type: DealType
  categories: Category[]
  menuItems: MenuItemOption[]
  initial: Deal
  error: string | null
  onCancel: () => void
  onSave: (payload: { type: DealType; name: string; config: any; custom_label: string | null; available_from: string | null; available_until: string | null; image_url: string | null }) => void
}) {
```

Add state for the new top-level fields near the existing `name`/`config` state:
```ts
  const [customLabel, setCustomLabel] = useState(initial.custom_label ?? '')
  const [availableFrom, setAvailableFrom] = useState(initial.available_from ?? '')
  const [availableUntil, setAvailableUntil] = useState(initial.available_until ?? '')
  const [imageUrl, setImageUrl] = useState(initial.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
```

Add a top-level fields block right after the "Deal name" field (before the `{type === 'bogo' && ...}` branch):
```tsx
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Custom Label (optional — overrides the auto-generated badge text)</label>
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Leave blank to use the default label"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Available From (optional)</label>
              <input
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Available Until (optional)</label>
              <input
                type="datetime-local"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Deal Image (optional)</label>
            {imageUrl && <img src={imageUrl} alt="" className="w-24 h-24 object-cover rounded-lg mb-2" />}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="text-sm text-zinc-400"
            />
          </div>
```

Replace the existing bundle JSX block:
```tsx
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
```

with:
```tsx
          {type === 'bundle' && (
            <>
              {config.groups.map((g: any, i: number) => (
                <SlotEditor
                  key={i}
                  group={g}
                  menuItems={menuItems}
                  categories={categories}
                  onChange={(next) => set(['groups', i], next)}
                  onRemove={config.groups.length > 1 ? () => set(['groups'], config.groups.filter((_: any, gi: number) => gi !== i)) : undefined}
                />
              ))}
              <button
                onClick={() => set(['groups'], [...config.groups, { label: '', min_qty: 1, max_qty: 1, item_ids: [] }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add slot
              </button>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Bundle price (£)</label>
                <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </>
          )}
```

Remove the `{type === 'fixed_meal' && ...}` JSX block entirely.

- [ ] **Step 4: Add the `SlotEditor` sub-component**

Add this new component in the same file, above `DealFormModal`:

```tsx
function SlotEditor({ group, menuItems, categories, onChange, onRemove }: {
  group: { label: string; min_qty: number; max_qty: number; item_ids: string[] }
  menuItems: MenuItemOption[]
  categories: Category[]
  onChange: (next: typeof group) => void
  onRemove?: () => void
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = menuItems.filter((m) => {
    if (categoryFilter && m.category !== categoryFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggleItem(id: string) {
    const next = group.item_ids.includes(id)
      ? group.item_ids.filter((x) => x !== id)
      : [...group.item_ids, id]
    onChange({ ...group, item_ids: next })
  }

  return (
    <div className="border border-zinc-800 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Slot Label</label>
          <input value={group.label} onChange={(e) => onChange({ ...group, label: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Min Qty</label>
          <input type="number" min={0} value={group.min_qty} onChange={(e) => onChange({ ...group, min_qty: parseInt(e.target.value) || 0 })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Max Qty</label>
          <input type="number" min={group.min_qty} value={group.max_qty} onChange={(e) => onChange({ ...group, max_qty: parseInt(e.target.value) || group.min_qty })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">Items in This Slot ({group.item_ids.length} selected)</p>
        {onRemove && <button onClick={onRemove} className="text-xs text-red-400 hover:underline">Remove slot</button>}
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find item..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg p-2 grid grid-cols-2 gap-1">
        {filtered.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm text-zinc-300 px-1 py-0.5 hover:bg-zinc-800 rounded cursor-pointer">
            <input type="checkbox" checked={group.item_ids.includes(m.id)} onChange={() => toggleItem(m.id)} />
            {m.name}
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire the image upload and new fields into `handleSave`**

Find where `DealFormModal`'s save button calls `onSave({ type, name, config })` and change it to upload the image first if one was selected, then include the new fields:

```tsx
          <button
            onClick={async () => {
              let resolvedImageUrl = imageUrl.trim() || null
              if (imageFile) {
                setImageUploading(true)
                const fd = new FormData()
                fd.append('file', imageFile)
                const res = await fetch('/api/admin/menu/upload', { method: 'POST', body: fd })
                const data = await res.json()
                setImageUploading(false)
                if (res.ok) resolvedImageUrl = data.url
              }
              onSave({
                type, name, config,
                custom_label: customLabel.trim() || null,
                available_from: availableFrom || null,
                available_until: availableUntil || null,
                image_url: resolvedImageUrl,
              })
            }}
            disabled={!name.trim() || imageUploading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-brand-red hover:bg-brand-red/80 text-white disabled:opacity-50"
          >
            {imageUploading ? 'Uploading...' : 'Save'}
          </button>
```

(This replaces the existing simpler `onClick={() => onSave({ type, name, config })}` button — keep the surrounding `Cancel` button and layout `div` unchanged.)

- [ ] **Step 6: Update `handleSave` in the parent to forward the new fields**

In `DealsAdminPage`, change:
```ts
  async function handleSave(payload: { type: DealType; name: string; config: any }) {
```
to:
```ts
  async function handleSave(payload: { type: DealType; name: string; config: any; custom_label: string | null; available_from: string | null; available_until: string | null; image_url: string | null }) {
```

The rest of `handleSave`'s body (the `fetch` call with `JSON.stringify(payload)`) needs no change — it already forwards the whole payload object.

- [ ] **Step 7: Typecheck**

Run: `cd chicken-time-reigate && npx tsc --noEmit`
Expected: no errors in `app/admin/deals/page.tsx`.

- [ ] **Step 8: Manual verification**

Run: `cd chicken-time-reigate && npm run dev`, log in as admin, go to `/admin/deals`, edit "Medium Meal Deal" (or whichever bundle survived Task 4's backfill), confirm the slot editor shows the backfilled `item_ids` as checked, add a new slot, search/filter items, save, and confirm the deal list still shows it correctly.

- [ ] **Step 9: Commit**

```bash
git add app/admin/deals/page.tsx
git commit -m "feat(deals): admin slot builder — explicit item picker, min/max, schedule, image, custom label"
```

---

### Task 7: Admin product form — remove Combo Role / Size Tier fields

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Remove the type fields, form state, and submit payload keys**

Remove `combo_category: 'main' | 'side' | 'drink' | null` from the item type interface (near line 46, alongside `size_tier: 'regular' | 'large' | null` — remove that too).

In the `ItemModal` form initialization:
```ts
        category: editingItem.category,
        combo_category: editingItem.combo_category ?? null,
        size_tier: editingItem.size_tier ?? null,
      }
      : { ...EMPTY_FORM, category: categories[0]?.slug ?? '', combo_category: null as 'main' | 'side' | 'drink' | null, size_tier: null as 'regular' | 'large' | null }
```
becomes:
```ts
        category: editingItem.category,
      }
      : { ...EMPTY_FORM, category: categories[0]?.slug ?? '' }
```

In the submit payload:
```ts
      combo_category: form.combo_category,
      size_tier: form.size_tier,
    }
```
remove those two lines (keep the closing `}`).

- [ ] **Step 2: Remove the JSX fields**

Delete the "Combo Role" `<select>` block and its conditional helper text:
```tsx
            <label className="block text-xs font-medium text-zinc-400 mb-1">Combo Role</label>
            <select
              value={form.combo_category ?? ''}
              onChange={e => {
                const val = (e.target.value || null) as 'main' | 'side' | 'drink' | null
                setForm(f => ({
                  ...f,
                  combo_category: val,
                  size_tier: val === 'main' ? null : f.size_tier,
                }))
              }}
            >
              <option value="main">Main</option>
              <option value="side">Side</option>
              <option value="drink">Drink</option>
            </select>
            {form.combo_category === 'main' && (
              <p className="text-[11px] text-zinc-500 mt-1">Mains are always regular size — no size tier needed.</p>
            )}
```
(read the actual surrounding JSX first — the snippet seen earlier in this session was truncated around the `<select>` open tag; delete the complete block including its wrapping container `<div>` and the label above it, plus the sibling "Size Tier" field block that follows it, down through wherever that field's closing `)}`  and container end.)

- [ ] **Step 3: Typecheck**

Run: `cd chicken-time-reigate && npx tsc --noEmit`
Expected: no errors in `app/admin/page.tsx`.

- [ ] **Step 4: Manual verification**

Run: `cd chicken-time-reigate && npm run dev`, go to `/admin` (menu manager), open the edit modal for any item, confirm "Combo Role"/"Size Tier" fields are gone and the form still saves successfully.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx
git commit -m "refactor(admin): remove Combo Role / Size Tier fields from product form

Deal-product association now happens entirely in the deals panel's
slot builder, not on the product itself."
```

---

### Task 8: `DealSlotPicker` component

**Files:**
- Create: `components/Deals/deal-slot-picker-logic.ts`
- Test: `components/Deals/deal-slot-picker-logic.test.ts`
- Create: `components/Deals/DealSlotPicker.tsx`
- Delete: `components/Deals/BundleGroupPicker.tsx`

**Interfaces:**
- Consumes: `ItemCustomizerDrawer` (existing, for the nested-modifier flow), `AddOn`/`OrderSelection` types from `components/ProductModal`.
- Produces: `slotQty(picks: {item_id: string; qty: number}[]): number`, `isSelectionComplete(groups: {min_qty: number; max_qty: number}[], picksByGroup: Record<number, {item_id: string; qty: number}[]>): boolean`, and the `DealSlotPicker` component with props `{ deal: { id: string; name: string; config: { groups: { label: string; min_qty: number; max_qty: number; item_ids: string[] }[]; price: number } }, itemsById: Map<string, { id: string; name: string; price: number; image_url: string | null; category: string; extras: {name: string; price: number}[] | null; removals: string[] | null; additions: string[] | null }>, onClose: () => void, onComplete: (picks: { item_id: string; qty: number; removals: string[]; additions: string[]; extras: {name: string; price: number}[] }[]) => void }`.

The project has no component-testing infrastructure (no React Testing Library, Vitest's `environment` is `node`, no existing `.test.tsx` anywhere) — adding one just for this component would be new scope, not something this feature needs. Instead, the slot-completion gating logic (the part actually worth testing — everything else is JSX) is extracted into a plain module and tested the same way `lib/deal-engine.ts` already is: pure functions, no DOM.

- [ ] **Step 1: Write the failing test for the pure logic**

```ts
// components/Deals/deal-slot-picker-logic.test.ts
import { describe, it, expect } from 'vitest'
import { slotQty, isSelectionComplete } from './deal-slot-picker-logic'

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd chicken-time-reigate && npx vitest run components/Deals/deal-slot-picker-logic.test.ts`
Expected: FAIL — `./deal-slot-picker-logic` doesn't exist yet.

- [ ] **Step 3: Implement the pure logic module**

```ts
// components/Deals/deal-slot-picker-logic.ts
export interface SlotPick { item_id: string; qty: number }
export interface SlotGroup { min_qty: number; max_qty: number }

export function slotQty(picks: SlotPick[]): number {
  return picks.reduce((s, p) => s + p.qty, 0)
}

export function isSelectionComplete(groups: SlotGroup[], picksByGroup: Record<number, SlotPick[]>): boolean {
  return groups.every((g, i) => {
    const count = slotQty(picksByGroup[i] ?? [])
    return count >= g.min_qty && count <= g.max_qty
  })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd chicken-time-reigate && npx vitest run components/Deals/deal-slot-picker-logic.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Write the component, using the tested logic module**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, X } from 'lucide-react'
import ItemCustomizerDrawer from '@/components/Menu/ItemCustomizerDrawer'
import type { ProductItem, OrderSelection } from '@/components/ProductModal'
import { slotQty, isSelectionComplete } from './deal-slot-picker-logic'

interface SlotItem {
  id: string
  name: string
  price: number
  image_url: string | null
  category: string
  extras: { name: string; price: number }[] | null
  removals: string[] | null
  additions: string[] | null
}

interface Pick {
  item_id: string
  qty: number
  removals: string[]
  additions: string[]
  extras: { name: string; price: number }[]
}

interface Group { label: string; min_qty: number; max_qty: number; item_ids: string[] }

interface Deal {
  id: string
  name: string
  config: { groups: Group[]; price: number }
}

interface Props {
  deal: Deal
  itemsById: Map<string, SlotItem>
  onClose: () => void
  onComplete: (picks: Pick[]) => void
}

function isCustomizable(item: SlotItem): boolean {
  return Boolean(item.extras?.length || item.removals?.length || item.additions?.length)
}

export default function DealSlotPicker({ deal, itemsById, onClose, onComplete }: Props) {
  // picks[groupIndex] is a list of Pick entries for that slot
  const [picks, setPicks] = useState<Record<number, Pick[]>>({})
  const [customizing, setCustomizing] = useState<{ groupIndex: number; item: SlotItem; existingIndex: number | null } | null>(null)

  function slotCount(groupIndex: number): number {
    return slotQty(picks[groupIndex] ?? [])
  }

  function addPlainPick(groupIndex: number, item: SlotItem) {
    setPicks((prev) => {
      const current = prev[groupIndex] ?? []
      const existing = current.find((p) => p.item_id === item.id)
      const next = existing
        ? current.map((p) => (p.item_id === item.id ? { ...p, qty: p.qty + 1 } : p))
        : [...current, { item_id: item.id, qty: 1, removals: [], additions: [], extras: [] }]
      return { ...prev, [groupIndex]: next }
    })
  }

  function removePick(groupIndex: number, item_id: string) {
    setPicks((prev) => {
      const current = prev[groupIndex] ?? []
      const existing = current.find((p) => p.item_id === item_id)
      if (!existing) return prev
      const next = existing.qty > 1
        ? current.map((p) => (p.item_id === item_id ? { ...p, qty: p.qty - 1 } : p))
        : current.filter((p) => p.item_id !== item_id)
      return { ...prev, [groupIndex]: next }
    })
  }

  function handlePillClick(groupIndex: number, item: SlotItem) {
    if (slotCount(groupIndex) >= deal.config.groups[groupIndex].max_qty) return
    if (isCustomizable(item)) {
      setCustomizing({ groupIndex, item, existingIndex: null })
      return
    }
    addPlainPick(groupIndex, item)
  }

  function handleCustomizerAdd(selection: OrderSelection) {
    if (!customizing) return
    const { groupIndex, item } = customizing
    const entry: Pick = {
      item_id: item.id,
      qty: selection.quantity,
      removals: selection.removals,
      additions: selection.additions ?? [],
      extras: selection.extras,
    }
    setPicks((prev) => ({ ...prev, [groupIndex]: [...(prev[groupIndex] ?? []), entry] }))
    setCustomizing(null)
  }

  const allComplete = isSelectionComplete(deal.config.groups, picks)

  function handleSubmit() {
    const all = Object.values(picks).flat()
    onComplete(all)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-heading font-black text-xl text-zinc-900">{deal.name}</p>
            <p className="text-sm text-zinc-400">£{deal.config.price.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          {deal.config.groups.map((group, gi) => {
            const count = slotCount(gi)
            return (
              <div key={gi}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-heading font-semibold text-zinc-900 text-sm">{group.label}</p>
                  <span className="text-[11px] font-semibold text-brand-red">
                    {count} of {group.min_qty === group.max_qty ? group.min_qty : `${group.min_qty}-${group.max_qty}`} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.item_ids.map((id) => {
                    const item = itemsById.get(id)
                    if (!item) return null
                    const pickedQty = (picks[gi] ?? []).filter((p) => p.item_id === id).reduce((s, p) => s + p.qty, 0)
                    const atMax = count >= group.max_qty && pickedQty === 0
                    return (
                      <div key={id} className={`rounded-xl border-2 overflow-hidden text-left ${pickedQty > 0 ? 'border-brand-red bg-brand-red/5' : atMax ? 'border-zinc-100 opacity-40' : 'border-zinc-100'}`}>
                        <button
                          onClick={() => handlePillClick(gi, item)}
                          disabled={atMax}
                          className="w-full text-left"
                        >
                          {item.image_url ? (
                            <div className="relative w-full h-20">
                              <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" />
                            </div>
                          ) : (
                            <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
                          )}
                          <div className="p-2.5 flex items-start justify-between gap-1">
                            <p className={`text-xs font-semibold leading-tight ${pickedQty > 0 ? 'text-brand-red' : 'text-zinc-800'}`}>{item.name}</p>
                            {pickedQty > 0 && <Check size={13} className="text-brand-red shrink-0 mt-0.5" />}
                          </div>
                        </button>
                        {pickedQty > 0 && (
                          <div className="flex items-center justify-between px-2.5 pb-2">
                            <button onClick={() => removePick(gi, id)} className="w-6 h-6 rounded-full border border-zinc-300 text-zinc-600 text-sm">−</button>
                            <span className="text-xs font-bold text-zinc-900">{pickedQty}</span>
                            <button onClick={() => handlePillClick(gi, item)} disabled={atMax} className="w-6 h-6 rounded-full border border-zinc-300 text-zinc-600 text-sm disabled:opacity-30">+</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allComplete}
          className={`w-full mt-6 font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${!allComplete ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'}`}
        >
          <span>{allComplete ? 'Add Bundle to Order' : 'Select required items'}</span>
          {allComplete && <span>£{deal.config.price.toFixed(2)}</span>}
        </button>
      </div>

      {customizing && (
        <ItemCustomizerDrawer
          item={{
            id: customizing.item.id,
            name: customizing.item.name,
            price: customizing.item.price,
            image: customizing.item.image_url ?? '',
            category: customizing.item.category,
            description: '',
            allergens: [],
            removables: customizing.item.removals ?? [],
            additions: customizing.item.additions ?? [],
            add_ons: customizing.item.extras ?? [],
          } as ProductItem}
          onClose={() => setCustomizing(null)}
          onAddToOrder={handleCustomizerAdd}
        />
      )}
    </div>
  )
}
```

Read `components/ProductModal.tsx` for the exact `ProductItem` field names before finalizing this step — the fields passed into the synthetic `item` object above (`image`, `removables`, `add_ons`, etc.) must match exactly what `ItemCustomizerDrawer` expects, since it's the same component used everywhere else in the app. Adjust field names if they differ from what's assumed here.

- [ ] **Step 6: Delete the old component**

Run: `git rm components/Deals/BundleGroupPicker.tsx`

(This will break `app/deals/page.tsx` and `components/Menu/ItemCustomizerDrawer.tsx`'s imports until Tasks 9-10 update them — that's expected and fixed in the next two tasks. Do not run the typecheck-must-pass check until after Task 10.)

- [ ] **Step 7: Commit**

```bash
git add components/Deals/deal-slot-picker-logic.ts components/Deals/deal-slot-picker-logic.test.ts components/Deals/DealSlotPicker.tsx
git commit -m "feat(deals): add DealSlotPicker — min/max slots, customizable items route through ItemCustomizerDrawer

Selection-completion gating extracted into deal-slot-picker-logic.ts
and unit-tested (project has no component-testing infra, so this is
the pure-logic slice worth testing, same pattern as deal-engine.ts).

Replaces BundleGroupPicker (deleted). Callers updated in the next two
commits."
```

---

### Task 9: Order page + `MenuCard` wiring, `ItemCustomizerDrawer` cleanup

**Files:**
- Modify: `app/order/page.tsx`
- Modify: `components/Menu/ItemCustomizerDrawer.tsx`

**Interfaces:**
- Consumes: `DealSlotPicker` from Task 8.

- [ ] **Step 1: Repoint `mealFromPriceFor` to match `item_ids`**

In `app/order/page.tsx`, change:
```ts
  const mealFromPriceFor = useMemo(() => {
    return (item: MenuItem): number | null => {
      const bundle = activeBundles.find((b) => b.config.groups.some((g) => g.category === item.category))
      return bundle ? bundle.config.price : null
    }
  }, [activeBundles])
```
to:
```ts
  const bundleFor = useMemo(() => {
    return (item: MenuItem) =>
      activeBundles.find((b) => b.config.groups.some((g: { item_ids: string[] }) => g.item_ids.includes(item.id)))
  }, [activeBundles])

  const mealFromPriceFor = useMemo(() => {
    return (item: MenuItem): number | null => bundleFor(item)?.config.price ?? null
  }, [bundleFor])
```

- [ ] **Step 2: Replace `openMealDrawer` with a `DealSlotPicker` opener**

Add state near the other drawer-related `useState` calls (alongside wherever `drawerItem`/`drawerInitialMeal` are declared):
```ts
  const [dealPickerFor, setDealPickerFor] = useState<{ deal: any; itemsById: Map<string, any> } | null>(null)
```

Replace:
```ts
  function openMealDrawer(item: MenuItem) {
    setDrawerInitialMeal(true)
    setDrawerItem(item)
  }
```
with:
```ts
  function openDealPicker(item: MenuItem) {
    const bundle = bundleFor(item)
    if (!bundle) return
    const itemsById = new Map(menuItems.map((m) => [m.id, {
      id: m.id, name: m.name, price: m.price, image_url: m.image, category: m.category,
      extras: m.add_ons ?? null, removals: m.removables ?? null, additions: m.additions ?? null,
    }]))
    setDealPickerFor({ deal: bundle, itemsById })
  }
```

Find every call site that passed `openMealDrawer` (e.g. as the `onOpenMealDrawer` prop to `MenuCard`) and rename to `openDealPicker` — the prop name on `MenuCard` itself (`onOpenMealDrawer`) can stay as-is (it's just a prop name) or be renamed to `onOpenDealPicker` for clarity; if renamed, update both the `MenuCard` function signature and its call sites consistently.

- [ ] **Step 3: Render `DealSlotPicker` and wire its `onComplete` into the cart**

Near wherever `drawerItem && <ItemCustomizerDrawer .../>` is rendered in the page's JSX, add:
```tsx
      {dealPickerFor && (
        <DealSlotPicker
          deal={dealPickerFor.deal}
          itemsById={dealPickerFor.itemsById}
          onClose={() => setDealPickerFor(null)}
          onComplete={(picks) => {
            for (const pick of picks) {
              handleAddToOrder({
                item: menuItems.find((m) => m.id === pick.item_id)!,
                quantity: pick.qty,
                removals: pick.removals,
                additions: pick.additions,
                extras: pick.extras,
                notes: '',
                totalPrice: 0, // handleAddToOrder doesn't use totalPrice for cart math (cartTotal recomputes from item.price + extras below); pass a placeholder consistent with OrderSelection's shape
              })
            }
            setDealPickerFor(null)
          }}
        />
      )}
```

Add the import near the other component imports:
```ts
import DealSlotPicker from '@/components/Deals/DealSlotPicker'
```

Before finalizing this step, check `OrderSelection`'s actual type in `components/ProductModal.tsx` to confirm `totalPrice` really is unused by `handleAddToOrder` (it wasn't referenced in the `handleAddToOrder` body read earlier this session) — if it turns out to matter elsewhere, compute it properly as `(item.price + extras total) * qty` instead of the placeholder `0`.

- [ ] **Step 4: Add the `DEAL` badge to `MenuCard`**

In `MenuCard`, add a new prop `hasDeal: boolean` to the function signature (alongside `mealFromPrice`), and add this JSX near the existing OFFER badge block (inside the image `<div>`, as a sibling — place it top-left via the existing unused-when-`isOffer`-is-true `item.badge` slot's position, or a new corner if `item.badge` is also present; simplest: render it only when `!isOffer` and no `item.badge`, matching the existing single-badge-at-a-time convention already in this card):

```tsx
        {hasDeal && !isOffer && !item.badge && (
          <span className="absolute top-3 left-3 z-10 text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-red text-white backdrop-blur-sm tracking-wide">
            DEAL
          </span>
        )}
```

Pass `hasDeal={bundleFor(item) != null || /* BOGO/order_discount membership check */}` from the call site. For the BOGO/order_discount membership check, add a small helper near `bundleFor`:

```ts
  const anyDealFor = useMemo(() => {
    return (item: MenuItem): boolean => {
      if (bundleFor(item)) return true
      return activeDeals.some((d) => {
        if (d.type === 'bogo') {
          const buyMatch = d.config.buy.item_ids?.includes(item.id) || d.config.buy.category === item.category
          const getMatch = d.config.get.item_ids?.includes(item.id) || d.config.get.category === item.category
          return buyMatch || getMatch
        }
        if (d.type === 'order_discount') {
          return d.config.scope === 'order' || d.config.category === item.category
        }
        return false
      })
    }
  }, [bundleFor, activeDeals])
```

This needs the *full* active deals list (not just `activeBundles`, which is already filtered to `type === 'bundle'`). Add a sibling state:
```ts
  const [activeDeals, setActiveDeals] = useState<{ id: string; type: string; config: any }[]>([])
```
and in the existing `/api/deals/active` fetch effect, set both:
```ts
  useEffect(() => {
    fetch('/api/deals/active')
      .then((r) => r.json())
      .then((deals: { id: string; type: string; config: any }[]) => {
        setActiveDeals(deals)
        setActiveBundles(deals.filter((d) => d.type === 'bundle'))
      })
      .catch(() => {})
  }, [])
```

Pass `hasDeal={anyDealFor(item)}` at the `<MenuCard .../>` call site.

- [ ] **Step 5: Delete the "Make it a Meal" block from `ItemCustomizerDrawer`**

Delete the `matchingBundle`/`bundleMenuItems` state, the `mealMode`-driven `useEffect` that fetches `/api/deals/active`, the `isMain`/`mealMode` state and `handleToggleMeal`, the "Make it a Meal toggle" JSX block, and the "Bundle group picker" JSX block (the `{mealMode && (matchingBundle ? ... : ...)}` section). Also delete the now-unused `BundleGroupPicker` import, `BundleDeal` interface, `ComboItem` interface, and `ComboItemCard` function (all were only used by the deleted meal-mode block).

Remove `onAddBundleItems?: (itemIds: string[]) => void` and `initialMealMode?: boolean` from `Props` (and their usage in the function signature/destructuring) — these were only for the deleted flow. Update every call site of `ItemCustomizerDrawer` across the codebase (`app/order/page.tsx`'s regular single-item drawer usage, and Task 8's `DealSlotPicker` usage) to drop these now-nonexistent props if they were passed.

Also remove the `drawerInitialMeal` state and its usages in `app/order/page.tsx` (it only existed to feed `initialMealMode`, which no longer exists).

- [ ] **Step 6: Typecheck and full test suite**

Run: `cd chicken-time-reigate && npx tsc --noEmit && npx vitest run`
Expected: no errors. If `ProductModal.tsx`'s actual field names differed from what Task 8/this task assumed, fix the mismatches now.

- [ ] **Step 7: Manual verification**

Run: `cd chicken-time-reigate && npm run dev`, go to `/order`:
- Confirm an item that's part of the backfilled bundle shows the `DEAL` badge and a "MEAL DEAL" row (repointed to open `DealSlotPicker`).
- Click it, confirm the slot picker opens with the bundle's slots, pick items within min/max, confirm the submit button gates correctly, submit, confirm the cart updates with the picked items and the deal discount shows at checkout quote time.
- Confirm a plain single item still opens the normal `ItemCustomizerDrawer` with no meal-mode remnants.

- [ ] **Step 8: Commit**

```bash
git add app/order/page.tsx components/Menu/ItemCustomizerDrawer.tsx
git commit -m "feat(order): DEAL badge + Deal to Cart via DealSlotPicker, remove drawer's Make it a Meal

MenuCard's existing SINGLE/MEAL DEAL row is repointed from category
matching + ItemCustomizerDrawer's old mealMode to item_ids matching +
DealSlotPicker. ItemCustomizerDrawer no longer knows about bundles at
all -- the card is now the only discovery path."
```

---

### Task 10: `/deals` page rewrite

**Files:**
- Modify: `app/deals/page.tsx`

**Interfaces:**
- Consumes: `DealSlotPicker` from Task 8.

- [ ] **Step 1: Rewrite to use `DealSlotPicker` and drop `fixed_meal`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DealSlotPicker from '@/components/Deals/DealSlotPicker'

interface Deal {
  id: string
  type: 'bogo' | 'bundle' | 'order_discount'
  name: string
  config: any
  custom_label: string | null
  image_url: string | null
}

interface MenuItem {
  id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean
  extras: { name: string; price: number }[] | null
  removals: string[] | null
  additions: string[] | null
}

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

  const itemsById = new Map(menuItems.filter((m) => m.is_available).map((m) => [m.id, m]))

  function addPicksToCart(picks: { item_id: string; qty: number; removals: string[]; additions: string[]; extras: { name: string; price: number }[] }[]) {
    const raw = sessionStorage.getItem('pendingCartEntries')
    const existing: Record<string, CartEntry> = raw ? JSON.parse(raw) : {}
    for (const pick of picks) {
      const current = existing[pick.item_id]
      existing[pick.item_id] = current
        ? { ...current, qty: current.qty + pick.qty }
        : { qty: pick.qty, removals: pick.removals, additions: pick.additions, extras: pick.extras }
    }
    sessionStorage.setItem('pendingCartEntries', JSON.stringify(existing))
    router.push('/order?from=deal')
  }

  const bundleDeals = deals.filter((d) => d.type === 'bundle')

  return (
    <div className="bg-white min-h-screen px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-zinc-900 mb-1">Deals</h1>
      <p className="text-zinc-500 text-sm mb-6">Build a bundle below, or qualifying discounts apply automatically at checkout.</p>

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="border border-zinc-100 rounded-2xl p-5 flex items-center gap-4">
            {deal.image_url && (
              <img src={deal.image_url} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-heading font-bold text-zinc-900">{deal.custom_label || deal.name}</p>
              {deal.type === 'bundle' && (
                <button
                  onClick={() => setActiveBundle(deal)}
                  className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  Build it — £{deal.config.price.toFixed(2)}
                </button>
              )}
              {(deal.type === 'bogo' || deal.type === 'order_discount') && (
                <p className="mt-2 text-xs text-zinc-400">Automatically applied when you qualify — just order normally.</p>
              )}
            </div>
          </div>
        ))}
        {bundleDeals.length === 0 && deals.length === 0 && (
          <p className="text-sm text-zinc-400">No active deals right now.</p>
        )}
      </div>

      {activeBundle && (
        <DealSlotPicker
          deal={activeBundle}
          itemsById={itemsById}
          onClose={() => setActiveBundle(null)}
          onComplete={(picks) => {
            addPicksToCart(picks)
            setActiveBundle(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd chicken-time-reigate && npx tsc --noEmit`
Expected: no errors in `app/deals/page.tsx`.

- [ ] **Step 3: Manual verification**

Run: `cd chicken-time-reigate && npm run dev`, go to `/deals`, confirm bundle deals show "Build it", opening `DealSlotPicker`; confirm BOGO/order_discount deals show the auto-apply note.

- [ ] **Step 4: Commit**

```bash
git add app/deals/page.tsx
git commit -m "refactor(deals): /deals gallery uses DealSlotPicker, drops fixed_meal branch"
```

---

### Task 11: Schedule-window filtering in read sites

**Files:**
- Modify: `app/api/deals/active/route.ts`
- Modify: `app/api/deals/quote/route.ts`
- Modify: `app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `isDealLive` from Task 1.

- [ ] **Step 1: `app/api/deals/active/route.ts`**

Change:
```ts
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
to:
```ts
import { isDealLive } from '@/lib/deal-engine'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, type, name, config, is_active, available_from, available_until, custom_label, image_url')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).filter(isDealLive))
}
```

- [ ] **Step 2: `app/api/deals/quote/route.ts`**

Change:
```ts
    supabaseAdmin.from('deals').select('id, type, name, config, is_active').eq('is_active', true),
```
to:
```ts
    supabaseAdmin.from('deals').select('id, type, name, config, is_active, available_from, available_until').eq('is_active', true),
```

and after the destructure, filter before passing to `matchDeals`:
```ts
  const result = matchDeals(items, (deals ?? []) as Deal[], menuItemsById)
```
to:
```ts
  const liveDeals = (deals ?? []).filter(isDealLive) as Deal[]
  const result = matchDeals(items, liveDeals, menuItemsById)
```

Add the import: `import { matchDeals, isDealLive, type Deal, type DealCartItem, type MenuItemLite } from '@/lib/deal-engine'` (merge with the existing import line rather than duplicating it).

- [ ] **Step 3: `app/api/checkout/route.ts`**

Change:
```ts
    const { data: activeDeals } = await supabaseAdmin
      .from('deals')
      .select('id, type, name, config, is_active')
      .eq('is_active', true)
```
to:
```ts
    const { data: activeDeals } = await supabaseAdmin
      .from('deals')
      .select('id, type, name, config, is_active, available_from, available_until')
      .eq('is_active', true)
```

and change:
```ts
    const { applied: appliedDeals, totalDiscount: rawDealsDiscountValue } = matchDeals(
      items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      (activeDeals ?? []) as Deal[],
      menuItemsById,
    )
```
to:
```ts
    const { applied: appliedDeals, totalDiscount: rawDealsDiscountValue } = matchDeals(
      items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      ((activeDeals ?? []) as Deal[]).filter(isDealLive),
      menuItemsById,
    )
```

Update the import: `import { matchDeals, isDealLive, type Deal, type MenuItemLite } from '@/lib/deal-engine'`.

- [ ] **Step 4: Typecheck and full test suite**

Run: `cd chicken-time-reigate && npx tsc --noEmit && npx vitest run`
Expected: all pass, zero errors anywhere in the project (this is the last task — full clean build is the exit criterion).

- [ ] **Step 5: Manual verification**

Run: `cd chicken-time-reigate && npm run dev`. In `/admin/deals`, edit a bundle to set "Available Until" to a past datetime, confirm it disappears from `/order`'s badges and `/deals` gallery, and that `/api/deals/active` no longer includes it. Reset it back to no schedule (or a future window) and confirm it reappears.

- [ ] **Step 6: Commit**

```bash
git add app/api/deals/active/route.ts app/api/deals/quote/route.ts app/api/checkout/route.ts
git commit -m "feat(deals): enforce available_from/until scheduling at every read site"
```

---

## Final sweep (part of Task 11's exit, not a separate task)

Before considering this plan done, run once more:

```bash
cd chicken-time-reigate
npx tsc --noEmit
npx vitest run
grep -rn "combo_category\|size_tier\|pick_qty\|fixed_meal" --include="*.ts" --include="*.tsx" app lib components
```

The grep should return nothing under `app`/`lib`/`components` (migrations under `supabase/` are expected to still mention them historically). Any hit here means a task above was incompletely applied — go back and fix it before calling the feature done.
