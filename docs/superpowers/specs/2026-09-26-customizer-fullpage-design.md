# Item Customizer — Full-Page Redesign (Sub-project B)

Second of a five-part customizer redesign (data model → **full-page layout** → delivery progress → VAT line → save preset). Builds on sub-project A (commit `8a18ef4`): priced spicy levels, `description`/`badge` on every option across all 9 modifier categories.

Scope is the standalone single-item "Add to order" flow from the menu grid (`app/order/page.tsx`). The deals/bundle popup (`components/Deals/DealSlotPicker.tsx`) is explicitly out of scope — it stays a popup, per the user's own framing ("all is design sample for the add product, not for deal").

## Decisions (approved 2026-09-26)

- Light theme (site's existing brand palette — `brand-red`/`brand-yellow`/`brand-dark`), not the dark theme from the Stitch reference mockup. Structure and section hierarchy from the mockup, not its colors.
- Full dedicated page, not a modal. Plain dynamic route, not an intercepting route — see "Routing" below.
- Rich per-option data (description, badge) already shipped in sub-project A; this phase is presentation only, no further schema changes.
- Extra features from the mockup (free-delivery progress, VAT line, save preset) are separate sub-projects C/D/E — not built here.
- Simple items (zero spicy levels, zero ingredients, zero priced-category options, zero free additions) skip the page and add directly to cart at qty 1, one tap, no navigation.
- Items with any real choice open the full page.

## Routing

`app/order/customize/[itemId]/page.tsx` — plain client-component dynamic route (first dynamic route in the app). Fetches `/api/menu-items` (same endpoint `/order` already uses) and finds the item by `itemId`; no new API route needed for a ~30-item catalog.

- Not found / sold out entirely → redirect to `/order`.
- "Add to Order" → writes the line into the persisted cart (see below), then `router.push('/order')`.
- Close / back → `router.back()`, falling back to `/order` if there's no history (arrived via direct link).

**Cart persistence** (prerequisite fix, done first): `app/order/page.tsx`'s cart is currently `useState<Cart>({})` with no persistence beyond one existing one-off `sessionStorage` handoff. Add a small `useCart()` hook (`lib/use-cart.ts`) that:
- Initializes from `sessionStorage.getItem('cart')` (falls back to `{}`).
- Writes to `sessionStorage` on every change via a `useEffect`.
- Is used by both `app/order/page.tsx` (replacing its raw `useState`) and the new customize page.

This is a correctness fix independent of the redesign — today, an accidental refresh on `/order` already silently empties the cart. Fixing it here because the new route makes the gap unavoidable, not because it's new scope.

## Page layout

Two-column desktop (`lg:grid-cols-12`, content `lg:col-span-8`, sidebar `lg:col-span-4 sticky top-6`), single column on mobile with the sidebar's content collapsed into the existing sticky-bottom-bar pattern (qty stepper + total + Add button), matching how the current drawer already handles phone width.

**Hero** — same content as today's drawer header (image, name, description, allergens, OFFER badge), restyled as a static page header block instead of a modal's top bar (no close-X; back navigation is the page `<Home>`/browser-back affordance plus an explicit "Back to menu" link).

**Numbered sections** (left column) — `ModifierSection` gains an optional `number?: number` prop, rendered as a small circular badge (`bg-white/20 text-white`, matches the mockup's circle-badge language) to the left of the title, inside the existing red header bar. Order: Spicy level, Ingredients, then each non-empty priced category in `PRICED_CATEGORIES` order (Extra Ingredients, Drinks Regular/Large, Sides, Fries Regular/Large, Dips, Add-ons, Other Extras), Free additions, Special instructions. Numbers are assigned sequentially to whichever sections are actually non-empty for this item — an item with no drinks doesn't leave a gap at "04".

**Sidebar / summary** (desktop right column, sticky) — promotes today's drawer footer + inline "Your selection" list into one card: quantity stepper, itemized selection list (unchanged logic from `ItemCustomizerDrawer.tsx`'s existing `hasSelection` block — spicy level, removed ingredients, each extra with price and category label, free additions, notes preview), running total, and the "Add to Order" button. No progress bar, no VAT line, no Save Preset (sub-projects C/D/E).

## Component changes

- `components/Menu/ModifierSection.tsx`: add `number?: number` prop → circular badge in the header bar.
- `components/Menu/ItemCustomizerDrawer.tsx`'s internal logic (config derivation, `spicyCost`/`unit`/`total` calculation, `handleAdd`) moves into a shared hook `lib/use-item-customization.ts` so the same logic drives both the new page and (unchanged) any place still needing the compact drawer — currently nothing else uses it after this change, but extracting the hook keeps the page component focused on layout rather than re-deriving pricing.
- New `app/order/customize/[itemId]/page.tsx`: the actual 2-column layout, built from the hook + `ModifierForm`/`ModifierSection`.
- `ItemCustomizerDrawer.tsx` itself is deleted once nothing imports it (only `app/order/page.tsx` does today); `onOpenDrawer` in `MenuCard` becomes a real `<Link>`/`router.push` to the customize route, gated by the "simple item" check.
- "Simple item" check: a small helper (`hasNoCustomization(config)` in `lib/order-modifiers.ts`) — true when `spicyLevels`, `ingredients`, `categories`, and `additions` are all empty.

## Testing

- `lib/order-modifiers.test.ts`: `hasNoCustomization` unit tests (empty item, item with only spicy, item with only free additions, etc).
- `lib/use-cart.test.ts` (new): persists to and restores from `sessionStorage`; survives a simulated remount.
- Manual, by a human: open a fully-loaded item (like the live-verified Classic Smash Burger) on desktop and phone widths, confirm sidebar/sticky-bottom-bar both compute the same total as checkout; add a simple item (e.g. a drink) and confirm it skips the page.

## Out of scope (later sub-projects)

Free-delivery progress bar (C), VAT breakdown line (D — needs UK VAT-treatment research before any number is shown), Save Preset (E — new table + API). Deals/bundle popup redesign (never in scope; explicitly excluded by the user).
