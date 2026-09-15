# Generalized Deals Engine — Design

**Date:** 2026-09-15
**Status:** Approved (brainstorming complete)
**Replaces:** Module 23 combo-meal system (`combo_discounts`, `/menu/combo`, `combo_category`/`size_tier`)

---

## 1. Overview

Today's combo system is one hardcoded deal shape: Medium/Large meal, main+side+drink, flat discount, picked through a dedicated wizard. This replaces it with an admin-configurable deals engine supporting four templates — BOGO, build-a-bundle, fixed-price meal (family/kids), and order/category discounts — auto-detected and auto-applied whenever a customer's cart qualifies, regardless of how the items got there.

**Key architectural decision:** items that make up a bundle/fixed-meal deal are added to the cart as their real, individual menu items — never collapsed into one synthetic cart line (unlike the old combo wizard). A single matching engine (`lib/deal-engine.ts`) inspects the cart, finds the best-value combination of applicable deals, and reduces the order total exactly like `promo_code` does today — one computed discount, fed into the existing Stripe-coupon + `discount_applied` pipeline. This means:
- No new columns on `order_items`, no per-item deal tagging.
- One engine, reused for detection at cart-preview time and re-verified server-side at checkout — client-computed discounts are never trusted.
- Guided pickers (the `/deals` page, the customizer's bundle group-picker) are pure UX convenience for *populating* the cart correctly; they are not a separate pricing code path.

## 2. Data Model

```sql
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

ALTER TABLE orders ADD COLUMN applied_deals JSONB DEFAULT NULL;
-- shape: [{ deal_id, name, type, savings }]
```

`config` shape per type:

| Type | `config` shape |
|---|---|
| `bogo` | `{ buy: {category_id?, item_ids?, qty}, get: {category_id?, item_ids?, qty, discount: "free"|{percent:number}} }` |
| `bundle` | `{ groups: [{label, category_id, pick_qty}], price }` |
| `fixed_meal` | `{ items: [{item_id, qty}], price }` |
| `order_discount` | `{ scope: "order"|"category", category_id?, min_subtotal?, discount: {type:"percent"|"amount", value} }` |

`category_id` references the existing `categories` table (Module 9) — no new taxonomy. `combo_category`/`size_tier` columns on `menu_items` and the `combo_discounts` table are left in place but unused (no destructive DROP in this migration — cleanup is a separate, deliberate follow-up).

**Legacy migration:** seed two `bundle` rows from the live `combo_discounts` medium/large rows, using the real `category_id` for "Chicken"/"Burgers" (mains), "Sides", "Drinks" from the `categories` table — the executor must query live category names/ids rather than assume slugs, since "mains" isn't itself a category (chicken/burgers items serve that role). Admin can adjust group categories post-migration if the mapping needs a tweak.

## 3. Matching Engine (`lib/deal-engine.ts`)

Pure function, no I/O:

```ts
function matchDeals(
  cartItems: CartItem[],
  activeDeals: Deal[],
  menuItemsById: Map<string, MenuItemRow>,   // for price/category/is_available lookups
): { applied: AppliedDeal[]; totalDiscount: number }
```

**Algorithm — greedy, best-marginal-savings first:**
1. Expand cart into a pool of "consumable units" (one unit per quantity, tagged with item id/category/price), excluding any `menu_item_id` where `is_available === false`.
2. Loop: for every active deal, compute the maximum savings it could yield from currently-unconsumed units (see per-type rules below). Pick the deal with the highest positive savings, mark its consumed units, record it in `applied`. Repeat until no deal yields positive savings.
3. Return `applied` + summed `totalDiscount`.

Per-type savings/consumption:
- **bogo** — count unconsumed qualifying "buy" units and "get" units (same-item overlap handled by reserving buy units before get units); applications = `floor(buyUnits / buy.qty)` capped by `floor(getUnits / get.qty)`; consume `applications × (buy.qty + get.qty)` units; savings = `applications × get.qty × (discount === 'free' ? unit_price : unit_price × percent)`.
- **bundle** — for each group, require ≥ `pick_qty` unconsumed units in that category; if all groups satisfy, consume the **highest-priced** qualifying units per group (maximizes discount since bundle price is flat regardless of which items fill it); savings = `sum(consumed unit prices) - price`. Repeats while cart still has enough units for another full bundle.
- **fixed_meal** — requires unconsumed units matching every `{item_id, qty}` exactly; consume them; savings = `sum(qty × normal price) - price`.
- **order_discount** — `scope: "order"` discounts remaining unconsumed subtotal (gated by `min_subtotal` against the *original* full subtotal); `scope: "category"` discounts only remaining unconsumed units in that category. Consumes the discounted units so a second `order_discount` deal can't double-dip the same money.

**Known ceiling:** greedy-first isn't a provably optimal exhaustive search across all deal subsets — for the realistic scale here (a few dozen active deals, single-digit cart line counts) it converges on the best or tied-best outcome in practice. Marked inline as `// ponytail: greedy best-marginal-savings, not exhaustive search — revisit if the deal catalog grows past ~20 concurrent active deals`.

## 4. API Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/deals/active` | Public | List active deals (for `/deals` page + customizer bundle lookup) |
| `POST /api/deals/quote` | Public | Body `{items}` → `{applied, totalDiscount}`, re-fetches deals+menu items server-side. Used by cart page for live preview. |
| `GET /api/admin/deals` | `manage_deals` | List all deals |
| `POST /api/admin/deals` | `manage_deals` | Create |
| `PATCH /api/admin/deals/[id]` | `manage_deals` | Update `name`/`config`/`is_active` |
| `DELETE /api/admin/deals/[id]` | `manage_deals` | Delete |

`manage_deals` is a new permission string, same pattern as existing `manage_menu` — assignable to staff via the existing permissions UI; `owner` role bypasses as always.

## 5. Checkout Integration

`app/api/checkout/route.ts`: after computing `subtotal` and before the promo/loyalty coupon block, call `matchDeals` (server-side, trusted menu-item/category/price data — never the client's). Fold the result into the existing discount pipeline:

```ts
const { applied: appliedDeals, totalDiscount: dealsDiscountValue } = matchDeals(items, activeDeals, menuItemsById)
const totalDiscountForStripe = discountAmount + pointsDiscountValue + dealsDiscountValue
const total = subtotal - discountAmount - pointsDiscountValue - dealsDiscountValue + delivery_fee
```

Orders insert gains `applied_deals: appliedDeals.length ? appliedDeals : null`. This is the only source of truth — the cart-page quote is advisory display only.

## 6. Customer-Facing UI

- **`app/deals/page.tsx`** (replaces `app/menu/combo/page.tsx`) — grid of active deal cards from `GET /api/deals/active`:
  - `bundle` → "Build it" opens `BundleGroupPicker` (new shared component, generalized from the old size/side/drink accordion — N groups, each a multi-select chip grid with a "2 of 2 selected" badge per group, reusing the reference-app-inspired chip pattern); on complete, adds each chosen real item to the cart normally.
  - `fixed_meal` → single "Add to Cart" button, adds each configured item at its normal price; engine discounts it at cart/checkout automatically.
  - `bogo` / `order_discount` → informational card only ("Automatically applied — no code needed"), optionally linking to the relevant category.
- **`components/Menu/ItemCustomizerDrawer.tsx`** — replace the hardcoded "Make it a Meal" block (`combo_category`/size-tier logic) with: look up active `bundle` deals whose `groups[]` includes this item's `category_id`; if found, render the same `BundleGroupPicker` inline instead of the old fixed size→side→drink accordion.
- **`/order` cart page** — on cart change (debounced), call `POST /api/deals/quote`; render an "🎉 Deal applied" banner per entry in `applied` with savings, and show the discounted total ahead of checkout.
- **Kitchen dispatch card, receipts drawer, `/track/[id]`, admin order detail** — wherever an order summary already renders, read `orders.applied_deals` and show a small line: `🎉 <name> — saved £X`. Purely additive rendering, no new data plumbing since it's already on the order row.

## 7. Error Handling

- `/api/deals/quote` failures degrade silently — cart shows undiscounted total, no error surfaced to customer (it's a preview, not the source of truth).
- Checkout **always** recomputes server-side from trusted DB data; a tampered client cart claiming a fake deal is simply ignored — this is a security boundary, not just a UX nicety.
- `matchDeals` treats `is_available === false` items as unconsumable, so a deal can't be satisfied by a sold-out item even if it's still sitting in someone's stale cart.
- Admin CRUD validates `config` shape server-side per `type` before insert/update (reject malformed group/item references).

## 8. Testing

- `lib/deal-engine.test.ts` (Vitest, already in the repo) — the required money-path check per type: bogo savings math, bundle highest-price consumption, fixed_meal exact match, order_discount min_subtotal gating, multi-deal best-marginal-savings ordering, and sold-out-item exclusion.
- Manual QA pass (checklist in the implementation plan) covering: admin create/edit/delete each of the 4 types, customer auto-apply via normal ordering (no wizard), guided `/deals` flows, and receipt/kitchen display.

## 9. Files Changed / Created

| File | Action |
|---|---|
| `supabase/migrations/20260915d_deals_engine.sql` | Create — enum, `deals` table, `orders.applied_deals`, legacy seed |
| `lib/deal-engine.ts` | Create |
| `lib/deal-engine.test.ts` | Create |
| `app/api/deals/active/route.ts` | Create |
| `app/api/deals/quote/route.ts` | Create |
| `app/api/admin/deals/route.ts` | Create |
| `app/api/admin/deals/[id]/route.ts` | Create |
| `app/api/checkout/route.ts` | Extend — call `matchDeals`, fold into discount pipeline |
| `app/admin/page.tsx` | Extend — replace "Combos" tab with "Deals" tab + 4 type-specific builder forms |
| `app/deals/page.tsx` | Create (replaces `app/menu/combo/page.tsx`) |
| `components/Deals/BundleGroupPicker.tsx` | Create (shared by `/deals` page and drawer) |
| `components/Menu/ItemCustomizerDrawer.tsx` | Extend — replace hardcoded meal-mode with `BundleGroupPicker` lookup |
| `app/order/page.tsx` | Extend — cart-side deal quote + banner |
| Kitchen dispatch card, receipts drawer, `/track/[id]`, admin order detail components | Extend — render `applied_deals` line |
| `app/menu/combo/page.tsx`, `app/api/menu/combo-items/route.ts`, `app/api/menu/combo-discounts/route.ts`, `app/api/admin/combo-discounts/*` | Delete — after migration verified live |

## 10. Out of Scope (this pass)

- Dropping `combo_category`/`size_tier`/`combo_discounts` columns/table — left inert, cleanup deferred.
- Deal date/time windows (happy hour, day-of-week) — `config` JSONB leaves room to add later without a schema change.
- Cross-group size constraints (old "can't have large side AND large drink") — bundle groups are independent in v1; a future deal-specific constraint can be added to `config` if a real deal needs it.
- Exhaustive (non-greedy) optimal deal-combination search.
- Redemption analytics/reporting on deal usage.
