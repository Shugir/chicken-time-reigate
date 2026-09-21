# Deals Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-screen bundle popup with inline pick options and admin-chosen paid upgrades.

**Architecture:** Extract the drawer's option sections into a shared `ModifierForm`; rebuild `DealSlotPicker` on it with an upgrades section; wire callers; admin form and API gain `upgrades`. No checkout or engine changes.

**Tech Stack:** Next.js (breaking-changes version: read `node_modules/next/dist/docs/` before framework-specific code), React, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-deals-phase3-design.md`

## Global Constraints

- Work on `master` in place. No branches or worktrees. Do not `git commit`, `git push` or `git stash`; the coordinator commits.
- Edit only the files listed for your task; another agent edits the others at the same time.
- Reuse the Phase 2 contract in `lib/order-modifiers.ts` (`SelectedExtra`, `ModifierConfig`, `unitPrice`, `formatExtra`, `toModifierConfig`) and `components/Menu/ModifierSection.tsx` (`ModifierSection`, `Pill`), `QtyStepper.tsx`.
- Do not change `lib/deal-engine.ts`, `lib/checkout-pricing.ts` or `app/api/checkout/**`.
- Verify with `npx vitest run <file>` (there is no `npm test`) and `npx tsc --noEmit` (takes minutes; run once at the end, timeout 600000 ms).
- Match surrounding style. No new dependencies.

## Shared contract (done by coordinator)

- `BundleConfig.upgrades?: { label?: string; item_ids: string[] }` and `BundleUpgrades` exported from `lib/deal-engine.ts`.
- `upgradesTotal(lines: { price: number; qty: number }[]): number` exported from `components/Deals/deal-slot-picker-logic.ts` (tested).
- New picker callback: `onComplete(picks: Pick[], upgrades: { item_id: string; qty: number }[])`.

## File Structure

| File | Owner | Change |
|---|---|---|
| `components/Menu/ModifierForm.tsx` | Task A | new shared form |
| `components/Menu/ItemCustomizerDrawer.tsx` | Task A | uses `ModifierForm` |
| `components/Deals/DealSlotPicker.tsx` | Task A | rebuilt |
| `app/order/page.tsx`, `app/deals/page.tsx` | Task A | new `onComplete` signature |
| `app/admin/deals/page.tsx` | Task B | Upgrades section |
| `app/api/admin/deals/route.ts` (+ `[id]/route.ts` if it validates separately), `route.test.ts` | Task B | validation and tests |

---

### Task A: Shared form, bundle popup, cart wiring (opus)

**Interfaces — Produces:**

```ts
// components/Menu/ModifierForm.tsx
export interface ModifierSelection { spicy: string | null; removals: string[]; additions: string[]; extras: SelectedExtra[] }
export const EMPTY_SELECTION: ModifierSelection
export default function ModifierForm(props: {
  config: ModifierConfig
  value: ModifierSelection
  onChange: (next: ModifierSelection) => void
  soldOut?: string[]          // names disabled with "Sold out"
}): JSX.Element               // renders Spicy, Ingredients, priced categories, Free additions; NOT notes or quantity
```

- [ ] **Step 1: Extract `ModifierForm`.** Move the section rendering and selection logic (pill single/multi stepper, tap-again-to-clear, ingredient tap-to-remove, Free label, sold-out) out of `ItemCustomizerDrawer.tsx` into `ModifierForm.tsx`. Behaviour must stay identical (same emitted `extras` shape `{ name, price, qty, category }`, spicy always single). The drawer keeps hero, quantity, notes and footer, and holds a `ModifierSelection` in state. Run `npx vitest run lib/order-modifiers.test.ts`.
- [ ] **Step 2: Rebuild `DealSlotPicker`.** Same props plus the new `onComplete(picks, upgrades)`. Sheet layout per the spec. Each slot lists its items (existing grid). Selecting an item adds one pick unit; picks render as rows under their slot (name, remove button, collapsed summary of options such as `Spicy: Hot · Coke ×2`, and a "Customise" toggle that expands `ModifierForm` inline for that unit). Items with no options add without a toggle. Keep `min_qty`/`max_qty` rules (`slotQty`, `isSelectionComplete`) and the `matchDeals`-based savings. Keep each pick unit as its own `Pick` entry (`qty: 1`) so different options per unit survive. Add the upgrades section from `deal.config.upgrades` (label default "Upgrade your deal"): one row per item found in `itemsById` (image, name, `+£price`, `QtyStepper`, 0–9). Footer total = `itemsSum - bundleSavings + extras on picks (unitPrice(item.price, p.extras) - item.price per pick) + upgradesTotal(...)`. Button text unchanged ("Add Bundle to Order", disabled until complete). Escape closes, scroll lock, `role="dialog"`, `aria-modal`.
- [ ] **Step 3: Wire callers.** `app/order/page.tsx` (`onComplete` near line 1297) and `app/deals/page.tsx` (`addPicksToCart`): after the existing per-pick adds, add each upgrade as a plain line (item found by id, `quantity: qty`, no options, `totalPrice: item.price * qty`). Keep existing behaviour for picks.
- [ ] **Step 4: Verify.** `npx vitest run lib/order-modifiers.test.ts components/Deals/deal-slot-picker-logic.test.ts`, then `npx tsc --noEmit`. Report changed files, how upgrades reach the cart, and any limitation hit (note the cart-keyed-by-item-id merge if picks of the same item collide).

### Task B: Admin Upgrades section and API validation (sonnet)

**Consumes:** `BundleUpgrades` from `lib/deal-engine.ts`; existing `ItemPicker` and `inSlot`.

- [ ] **Step 1: API test first.** In `app/api/admin/deals/route.test.ts` (create it; call `validateConfig` exported from `route.ts`) add cases: bundle with valid `upgrades` passes; `item_ids` not an array, non-string ids, more than 30 ids, label over 60 chars, or `upgrades` not an object each return an error string; bundle without `upgrades` still passes. Run it and see the new cases fail.
- [ ] **Step 2: Validation.** In `validateConfig` (bundle branch) implement the rules above. `[id]/route.ts` already calls `validateConfig`; confirm it needs no change.
- [ ] **Step 3: Admin form.** In `app/admin/deals/page.tsx`, for `type === 'bundle'` after the slots and "+ Add slot": an "Upgrades" block with optional label input (placeholder "Upgrade your deal") and `ItemPicker` bound to `config.upgrades.item_ids`. Selecting nothing removes `upgrades` from the config on save. Show an amber inline warning listing chosen upgrade items that fall inside any slot (`inSlot({ item_ids: g.item_ids, category: g.category }, item)`), with the text "<names> also sit in a slot, so the deal may count them as bundle items."
- [ ] **Step 4: Verify.** `npx vitest run app/api/admin/deals/route.test.ts`, then `npx tsc --noEmit`. Report changed files.

### Task C: Integration (coordinator)

- [ ] Review both diffs, run all related vitest files and `npx tsc --noEmit`.
- [ ] Commit per workstream, update ruflo memory and Claude memory, run the graphify update, commit `graphify-out/` separately.
- [ ] Give the user the manual test steps from the spec.
