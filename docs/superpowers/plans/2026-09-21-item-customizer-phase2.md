# Item Customizer Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers choose spicy level, ingredients and 8 categories of priced modifiers in a rebuilt drawer, and the choice flows through cart, checkout, `order_items`, kitchen, dispatch, receipts, printer and account history.

**Architecture:** One shared contract (`lib/order-modifiers.ts`, done) defines the selection shape, pricing and label helpers. Three workstreams with disjoint file ownership consume it in parallel: A (customer UI and menu API), B (checkout), C (display surfaces).

**Tech Stack:** Next.js (breaking-changes version: read `node_modules/next/dist/docs/` before writing framework code), React, Supabase, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-item-customizer-phase2-design.md`

## Global Constraints

- Work on `master` in place. No branches, no worktrees. Do not `git commit` or `git push`; the coordinator commits.
- Edit only the files listed for your task. Other agents edit the others at the same time.
- `extras` element shape everywhere: `{ name: string; price: number; qty?: number; category?: string }` (`SelectedExtra`). Missing `qty` means 1. Never assume `qty` exists when reading.
- Line unit price = `unitPrice(base, extras)`; line total = unit price × quantity. Never sum `e.price` alone.
- Show extras with `formatExtra(e)`. Show spicy level as its own line, e.g. `Spicy: Hot`.
- `order_items` columns that already exist: `spicy_level TEXT`, `additions JSONB DEFAULT '[]'`, `extras JSONB`, `removals`. No new migrations.
- Do not change how checkout trusts the client `price`. Do not touch `lib/deal-engine.ts` or `app/admin/**`.
- Verify with `npx tsc --noEmit` (takes minutes; run it once at the end of your task) and the vitest files named in your task (`npx vitest run <file>`; there is no `npm test`).
- Style: match surrounding code. No new dependencies.

## File Structure

| File | Owner | Change |
|---|---|---|
| `lib/order-modifiers.ts`, `.test.ts` | done | shared contract |
| `components/ProductModal.tsx` | A | `OrderSelection` gains `spicy_level?`; `AddOn` becomes an alias of `SelectedExtra` |
| `components/Menu/ItemCustomizerDrawer.tsx` | A | rebuilt |
| `components/Menu/ModifierSection.tsx`, `QtyStepper.tsx` | A | new |
| `app/api/menu-items/route.ts` | A | select the 11 new columns |
| `app/order/page.tsx`, `app/deals/page.tsx`, `components/Deals/DealSlotPicker.tsx` | A | map rows with `toModifierConfig`, carry `spicy_level`, price with `unitPrice` |
| `app/api/checkout/route.ts`, `route.test.ts`, `app/checkout/page.tsx` | B | persist and display new fields |
| `app/kitchen/page.tsx`, `app/api/kitchen/**`, `app/admin/dispatch/page.tsx`, `app/api/admin/dispatch/route.ts` | C | show new fields |
| `components/CustomerReceipt.tsx`, `components/admin/receipts/*`, `app/api/admin/receipts/route.ts`, `app/api/admin/print/route.ts`, `lib/printer.ts` | C | show new fields |
| `app/account/page.tsx` | C | show new fields, reorder keeps them |

## Interfaces (from `lib/order-modifiers.ts`, already implemented)

```ts
type SelectMode = 'single' | 'multi'
interface PricedOption { name: string; price: number }
interface SelectedExtra extends PricedOption { qty?: number; category?: string }
interface ModifierConfig {
  spicyLevels: string[]; spicyMode: SelectMode
  ingredients: string[]; additions: string[]
  categories: { key: PricedCategoryKey; label: string; options: PricedOption[]; mode: SelectMode }[] // non-empty only
}
const PRICED_CATEGORIES: readonly { key: PricedCategoryKey; label: string }[]
function toModifierConfig(src: ModifierSource): ModifierConfig
function extraQty(e: { qty?: number }): number
function extrasTotal(extras: { price: number; qty?: number }[]): number
function unitPrice(base: number, extras: { price: number; qty?: number }[]): number
function formatExtra(e: { name: string; qty?: number }): string
```

Cart line / checkout item shape (workstreams A and B agree on this):

```ts
{ menu_item_id?: string; name: string; price: number /* unit incl. extras */; quantity: number; totalPrice: number
  spicy_level?: string; removals: string[]; additions: string[]; extras: SelectedExtra[]; notes?: string }
```

---

### Task 0: Shared contract (DONE by coordinator)

- [x] `lib/order-modifiers.ts` and `lib/order-modifiers.test.ts` written; `npx vitest run lib/order-modifiers.test.ts` passes (9 tests).

### Task A: Customer drawer, menu API, order and deals pages

**Files:** see the table (owner A). **Consumes:** contract above. **Produces:** `ItemCustomizerDrawer` with unchanged props `{ item, onClose, onAddToOrder }`; `OrderSelection` with `spicy_level?: string`, `removals`, `additions`, `extras: SelectedExtra[]`, `notes`, `totalPrice`.

- [ ] **Step 1: Menu API.** `app/api/menu-items/route.ts`: add `spicy_levels, ingredients, add_ons, drinks_regular, drinks_large, dips, sides, fries_regular, fries_large, other_extras, modifier_select_modes` to the `.select(...)` string.
- [ ] **Step 2: Types.** In `components/ProductModal.tsx` make `AddOn` an alias of `SelectedExtra`, add `spicy_level?: string` to `OrderSelection`, and add a `modifiers?: ModifierConfig` field to `ProductItem` (drawer reads it; other consumers ignore it). Keep the existing `removables`, `additions`, `add_ons` fields so `ProductModal` and deals keep compiling.
- [ ] **Step 3: Row mapping.** In `app/order/page.tsx`, `app/deals/page.tsx` and `DealSlotPicker.tsx`, where DB rows become `ProductItem`, set `modifiers: toModifierConfig(row)` and keep the legacy fields populated. Extend the `MenuItem` row types with the new columns.
- [ ] **Step 4: Drawer.** Rebuild `ItemCustomizerDrawer` per the spec section "Customer drawer": sections Spicy level, Ingredients, priced categories, Free additions, Special instructions; hide empty sections; pill (single, tap again to clear) or stepper (multi, qty ≥ 0) per `mode`; ingredients start selected, deselected go to `removals`; price 0 shows "Free"; names in `item.sold_out_extras` disabled with "Sold out"; sticky total via `unitPrice`; phone bottom sheet / desktop centered card (max width 512px); Escape closes; body scroll lock; 44px touch targets; `role="dialog"`. Emit extras as `{ name, price, qty, category: <category key> }` (one entry per option with qty ≥ 1), `spicy_level` when chosen, and `additions` for chosen free additions. Fall back to the legacy render (single flat list) when `item.modifiers` is missing. Use existing brand tokens (`brand-red`, `font-heading`) and the light card style already used in `app/order/page.tsx`.
- [ ] **Step 5: Cart and pricing.** In `app/order/page.tsx` and `app/deals/page.tsx` keep `spicy_level` in `CartEntry`, price lines with `unitPrice(item.price, entry.extras)`, show `spicy_level` and `formatExtra` in the cart UI, and pass `spicy_level`, `additions`, `extras` (with `qty`, `category`) into the checkout payload. `DealSlotPicker` picks keep `spicy_level` and their extras' `qty`.
- [ ] **Step 6: Verify.** `npx vitest run lib/order-modifiers.test.ts` and `npx tsc --noEmit` pass. Report every changed file.

### Task B: Checkout

**Files:** `app/api/checkout/route.ts`, `app/api/checkout/route.test.ts`, `app/checkout/page.tsx`. **Consumes:** cart item shape above and `formatExtra`, `extraQty`.

- [ ] **Step 1: Failing test.** In `route.test.ts` add a case posting an item with `spicy_level: 'Hot'`, `additions: ['Extra Sauce']`, `extras: [{ name: 'Coke', price: 1.5, qty: 2, category: 'drinks_regular' }]` and assert the `order_items` insert receives `spicy_level: 'Hot'`, `additions: ['Extra Sauce']` and the extras with `qty` and `category` unchanged. Follow the mocking style already in the file. Run it: it must fail.
- [ ] **Step 2: Implement.** `CartItem` gains `spicy_level?: string` and `additions?: string[]`; `extras` typed `SelectedExtra[]`. The `order_items` insert adds `spicy_level: item.spicy_level ?? null` and `additions: item.additions ?? []`. The Stripe line description joins `formatExtra` labels and prefixes `Spicy: <level>` when set. The sold-out check stays name-based. Do not change price handling.
- [ ] **Step 3: Checkout page.** `app/checkout/page.tsx` line items show `Spicy: <level>`, `formatExtra` labels and additions; totals use `unitPrice`-consistent values from the cart (do not recompute differently from the order page).
- [ ] **Step 4: Verify.** `npx vitest run app/api/checkout/route.test.ts` passes, then `npx tsc --noEmit`. Report changed files.

### Task C: Display surfaces

**Files:** see the table (owner C). **Consumes:** `formatExtra`.

- [ ] **Step 1: Data.** Wherever these screens or APIs select `order_items` columns, add `spicy_level` and `additions` (kitchen orders API, kitchen delivery API, dispatch API, receipts API, print API, account page query). Extend the local item types (`app/kitchen/page.tsx`, dispatch page, `components/admin/receipts/types.ts`, `CustomerReceipt.tsx`, `lib/printer.ts`, account page) with `spicy_level?: string | null` and `additions?: string[] | null`; `extras` elements gain `qty?: number`.
- [ ] **Step 2: Render.** Show, in this order per line: `Spicy: <level>` (when set), removals (existing "NO …" style), additions (`+ <name>`), extras via `formatExtra`. Kitchen, dispatch, admin receipt drawer, customer receipt and the printed ticket in `lib/printer.ts` must all show the spicy level prominently (kitchen: same weight as removals). Follow each screen's existing styling and the printer's existing text layout.
- [ ] **Step 3: Account reorder.** `app/account/page.tsx` reorder rebuilds cart lines with `spicy_level`, `additions` and extras (`qty`, `category` preserved).
- [ ] **Step 4: Verify.** `npx tsc --noEmit` passes. Report changed files and one sentence per screen on what it now shows.

### Task D: Integration (coordinator)

- [ ] Read every agent diff; fix contract mismatches.
- [ ] `npx vitest run` on `lib/order-modifiers.test.ts`, `lib/deal-engine.test.ts`, `app/api/checkout/route.test.ts`; `npx tsc --noEmit`.
- [ ] Commit per workstream; push only when the user asks.
- [ ] Hand the user the manual check from the spec.
