# Deals Phase 3 — One-Screen Bundle Popup With Upgrades

Builds on the Phase 2 customizer (`lib/order-modifiers.ts`, `components/Menu/*`) and the checkout price recompute (`lib/checkout-pricing.ts`). Approved 2026-09-21: "One screen, upgrades on the bundle".

## Goals

- A customer builds a bundle in one popup: pick items per slot, set each pick's options inline (spicy level, ingredients, free additions, that item's paid extras), then optionally add upgrades. No second drawer.
- The admin chooses, per bundle deal, which menu items are offered as upgrades.

## Decisions

- **Upgrades are ordinary menu items at their normal price**, added to the cart as normal lines. Checkout's server-side price recompute and the deals engine need no change.
- **Config**: `BundleConfig.upgrades?: { label?: string; item_ids: string[] }` (type already in `lib/deal-engine.ts`). Absent or empty `item_ids` means no upgrade section. Default label "Upgrade your deal".
- **Shared form**: the drawer's option sections move into `components/Menu/ModifierForm.tsx`, used by both the item drawer and the inline pick rows.
- **Popup layout**: bottom sheet on phones, centered card (max width 560px) on desktop, sticky footer with live total, Escape closes, body scroll locked, 44px touch targets. Same look as the Phase 2 drawer.
- **Live total** = deal price (or percent-off total, using the engine's `matchDeals` result as today) + paid extras on picks + upgrades (`upgradesTotal`).
- **Cart wiring**: `DealSlotPicker.onComplete(picks, upgrades)`; `upgrades` is `{ item_id: string; qty: number }[]` (qty ≥ 1). Order page and deals page add picks (as today) then each upgrade as a plain line.

## Known limitations (not fixed here)

- The order page cart is keyed by menu item id, so two picks of the same item with different options merge and the last selection wins. Follow-up: key cart lines by item plus options.
- If an upgrade item also belongs to one of the deal's slots, the deal engine can count it as the bundled item. The admin form warns when this happens; the engine is unchanged.

## Admin

Bundle form gets an "Upgrades" section after the slots: optional label input and the existing `ItemPicker`. Inline warning listing any chosen upgrade that falls inside a slot (`inSlot`). `POST/PATCH /api/admin/deals` validation: `upgrades` optional; when present it must be an object with `item_ids` an array of strings (max 30) and `label`, if given, a string of at most 60 characters.

## Testing

vitest: `upgradesTotal` (done), deals API `validateConfig` upgrade cases. `npx tsc --noEmit` clean. Manual by a human: build a bundle with inline options and upgrades, check out, confirm the kitchen ticket lists the picks with options and the upgrade lines.
