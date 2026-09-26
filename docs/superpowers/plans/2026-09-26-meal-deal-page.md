# Meal Deal as a Full Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Replace the meal-deal pop-up (`components/Deals/DealSlotPicker.tsx`) with a full page at `/order/deal/[dealId]`, styled like the single-item customize page. When the customer opened it from an item's **MEAL DEAL £x +** button, that item is pre-selected and locked with its options available. Tabs let the customer switch between deals when the item belongs to more than one.

**Owner request (2026-09-26), in intent:**
- Tapping "MEAL DEAL £xx.xx +" selects the tapped item automatically. Its customisation options are shown, following the single flow. The tapped item's slot shows no other items.
- The rest of the deal's slots are then shown to choose from.
- If the item belongs to more than one deal, tabs let the customer choose the deal. Each tab shows that deal's price, and the tapped item stays auto-chosen in every tab: the customer can't switch it for another item.
- Other customisable picks show their options too.
- No pop-up: it is a separate page, like the "SINGLE +" flow, with the same style.

This reverses the earlier "deals popup out of scope" rule, by the owner's decision.

**Tech:** Next 16.2.7 App Router client pages, React 19, Tailwind 4, Vitest node env. AGENTS.md applies: read `node_modules/next/dist/docs/` for `useParams`, `useSearchParams` (needs a Suspense boundary) and `useRouter`.

## Existing code to reuse

- **Single customize page:** `app/order/customize/[itemId]/page.tsx`. Reuse its layout (hero, `lg:grid-cols-12`, sticky receipt, mobile sticky bar), `queueCartLine`, the double-Add `useRef` guard, `router.replace('/order')`, and the storage try/catch.
- **`components/Menu/GroupedCustomizer.tsx`:**
  - option-card rendering (single / pick / multi / spicy / ingredients / extras, sold-out)
  - #1A1A1A group header bar with the red number chip
  - #626262 sub-section bars
  - `lib/customizer-layout.ts`: `customizerLayout`, `receiptLines`, `NOTES_MAX`, quick notes
- **`components/Menu/SelectionReceipt.tsx`:** the "Your Selection" panel and the "Add +" CTA with price.
- **Deal logic:**
  - `lib/deal-engine.ts`: `inSlot`, `matchDeals` (the same function checkout uses, so the page's discount equals what checkout applies), `BundleConfig`, `BundleUpgrades`
  - `components/Deals/deal-slot-picker-logic.ts`: `slotQty`, `isSelectionComplete`, `upgradesTotal`, all tested
  - today's pop-up `components/Deals/DealSlotPicker.tsx`: picks per slot, per-unit options and notes, upgrades, total math
- **Where the pop-up is used today:**
  - `app/order/page.tsx`: `openDealPicker`, `bundleFor`, `mealFromPriceFor`, and `DealSlotPicker` `onComplete`, which calls `handleAddToOrder` per pick and per upgrade
  - `app/deals/page.tsx`: `addPicksToCart` queues through `pendingCartEntries`
- **Data:** `/api/deals/active` returns `{ id, type, name, config }`; bundles have `type === 'bundle'`. `/api/menu-items` returns the menu rows (map them with `dbToMenuItem` / `itemConfig` from `lib/menu-items.ts`).

## Behaviour

1. **Route:** `/order/deal/[dealId]`, with an optional `?item=<menuItemId>` naming the tapped item.
2. **Deal tabs.** Shown only with `?item=` and when that item appears in two or more active bundle deals.
   - Tabs are `role="tablist"` / `role="tab"`, at least 44px tall, keyboard operable.
   - Each tab reads "Deal name · £12.99" (or "· 20% off").
   - The selected tab is the current `dealId`. Switching calls `router.replace('/order/deal/<otherId>?item=<same>')` and resets that deal's picks except the locked item.
   - With `?item=` and a `dealId` that doesn't contain the item: go to the first deal that does. If none does, open the deal without a locked item.
3. **Locked item.** When `?item=` is present, the tapped item is pre-picked as one unit in the FIRST slot of the deal whose `inSlot(group, item)` is true.
   - It can't be removed or swapped. It shows a "Your choice" label instead of a remove button.
   - That slot lists no other items. If its `max_qty` is above 1, the customer may add more units of the same item, up to `max_qty`, and nothing else.
   - The locked unit's options open by default when the item has any.
4. **Other slots** are the deal's other groups in their configured order. Each one shows:
   - the slot label and "n of m selected"
   - item cards for the items in that slot (`inSlot`, available items only), each with photo, name and a check when picked
   - one unit per tap, up to `max_qty`
   - each picked unit as a row with its option summary, a Customise toggle that opens the same option cards the single page uses, and a remove button
5. **Per-unit options.** The same UI as the single page: #626262 sub-section bars and option cards with identical selection rules, plus a short notes field (max 200) per unit. Extract a reusable `ItemOptionSections` from `GroupedCustomizer` (it renders the option sections for one item's `layout` without group number cards). Use it on both pages, so the single page doesn't change visually.
6. **Upgrades** (`config.upgrades.item_ids`) appear as a final group, "Upgrade your deal", with steppers. They are added at normal menu price, as today.
7. **Numbered groups**, like the single page:
   - 01 = the locked item's slot (titled with the slot label, e.g. "Your Burger")
   - then the other slots
   - then Upgrades
   - then Special Instructions is not needed: notes are per unit
   - the receipt is the last number

   Each group card uses the #1A1A1A header bar with a red number chip and an "N Selected" chip.
8. **Hero:** the deal name, the deal price ("£12.99 meal deal", or "20% off selected items"), the tapped item's photo (or the first slot item's), and short text "Choose your items below".
9. **Receipt ("Your Selection").**
   - One line per picked unit: slot label, item name, extra-cost lines.
   - Deal math:
     - Items at menu price
     - Meal deal saving, from `matchDeals`, the same as today's pop-up math
     - Extras & upgrades
     - Total
   - CTA "Add +" with the total. It is disabled with "Select required items (n left)" until `isSelectionComplete`.
   - Reset returns to the locked item only.
   - Save Preset / VAT: none here.
10. **Add.** Queue every picked unit and every upgrade as normal cart lines via `queueCartLine(sessionStorage, …)`, one line per unit with its options and notes (the same shapes `DealSlotPicker` `onComplete` produced). Then `router.replace('/order')`. Checkout's deal engine applies the bundle price, exactly as today. Use the double-tap guard and the storage try/catch.
11. **Errors.** Unknown or inactive deal, or no bundle deals: toast "That deal isn't available right now." and `router.replace('/order')`, like the single page.

## Callers

- **`app/order/page.tsx`:**
  - The **MEAL DEAL** button navigates to `/order/deal/<firstDealId>?item=<itemId>`.
  - `bundleFor` becomes `bundlesFor(item)`, returning all matching bundles.
  - The card label shows the lowest fixed price as "from £x" when there are several fixed-price deals. With one deal the label is unchanged, and percent deals keep "n% off".
  - Remove `DealSlotPicker` usage, `dealPickerFor` state, and `openDealPicker`. Keep `handleAddToOrder` only if still used; otherwise delete it.
- **`app/deals/page.tsx`:** each deal's "build" action navigates to `/order/deal/<dealId>` (no `?item`). Remove its `DealSlotPicker` usage and `addPicksToCart` if unused. Its cart queue already goes through `pendingCartEntries`, so `/order` merges as before.
- **Delete** `components/Deals/DealSlotPicker.tsx` once nothing imports it. Keep `deal-slot-picker-logic.ts` and its tests.

## Tests (node env)

A pure helper `lib/deal-page.ts` with tests:
- `bundlesContaining(deals, item): BundleDeal[]`
- `lockedSlotIndex(deal, item): number | -1`
- `slotItems(deal, groupIndex, items, lockedItem?): MenuItem[]`: the locked slot returns only the locked item
- `dealPriceLabel(config): string`
- `cardDealLabel(bundles): string | null`: "from £x" logic

Cover:
- an item in 0, 1 or 2 deals
- the locked slot showing only the locked item
- category-based versus item_ids-based slots
- percent versus fixed labels

## Verification

- `npx tsc --noEmit`, `npx vitest run`, and eslint on the touched files with no new findings.
- Browser (dev server already on http://localhost:3027), at 1280 and 375:
  - Find an item with a MEAL DEAL row on /order; `/api/deals/active` shows which bundles exist.
  - Tap it: the page opens with the item locked and its options.
  - Pick the other slots: the CTA enables and the total equals the pop-up's old math (items − `matchDeals` discount + extras + upgrades).
  - Add: /order's cart pill shows the lines.
  - Tabs appear if an item belongs to two deals. If no live item is in two deals, say so and rely on the tests.
  - /deals build links open the page.
  - No horizontal scroll at 375.
