# Item Customizer Phase 2 — Customer Drawer + Order Data Flow

Builds on Phase 1 (commits ed52dd0, 123db58, f230d1b): `menu_items` has `spicy_levels`, `ingredients`, 8 priced category columns and `modifier_select_modes`; `order_items` has `spicy_level` and `additions`. Phase 1 admin writes them. This phase makes customers see and choose them and carries the choice through checkout, kitchen, receipts and printing. Phase 3 (deal hybrid) and the server-side price recompute are out of scope.

## Decisions (approved 2026-09-21)

- Scope is the whole order path, not the drawer alone ("wherever changes need do it in the whole project").
- Checkout keeps trusting the client `price` (existing behaviour). Server-side price recompute is a separate follow-up.

## Data contract — `lib/order-modifiers.ts`

Single source of truth used by every workstream.

- `SelectedExtra = { name, price, qty?, category? }`. `qty` defaults to 1. Stored in `order_items.extras` JSONB (already untyped). Old rows have no `qty`, so readers must treat missing as 1.
- Selection fields on a line: `spicy_level?: string`, `removals: string[]` (ingredients the customer deselected), `additions: string[]` (free legacy additions), `extras: SelectedExtra[]`.
- Line unit price = base price + Σ(extra.price × qty). Line total = unit price × quantity. Helpers: `extraQty`, `extrasTotal`, `unitPrice`, `formatExtra` ("Coke ×2", "Coke" when qty 1).
- `toModifierConfig(menuItem)` builds the drawer's view of an item. Per-field legacy fallback: `ingredients` empty → use `removals`; `add_ons` empty → use `extras`. `modes` merged over `DEFAULT_SELECT_MODES`.

## Customer drawer

`components/Menu/ItemCustomizerDrawer.tsx` rebuilt, with `ModifierSection` and `QtyStepper` under `components/Menu/`.

- Sections in order: Spicy level, Ingredients, the 8 priced categories, Free additions, Special instructions. A section is hidden when empty.
- Spicy level and any category in `single` mode: pill choice, pick one, tap again to clear. `multi` mode: stepper per option with quantity ≥ 0. Ingredients: all selected by default, tap to deselect (deselected go to `removals`).
- Price 0 shows "Free". Names in `sold_out_extras` are disabled in every category.
- Sticky footer with live total. Phone: bottom sheet. Desktop: centered card, max width 512px. Escape closes, body scroll locked, 44px touch targets.
- Props stay `{ item, onClose, onAddToOrder }` so `app/order/page.tsx` and `DealSlotPicker` keep working. `OrderSelection` gains `spicy_level?` and `extras` become `SelectedExtra[]`.

## Data flow

1. `GET /api/menu-items` selects the 11 new columns.
2. Order page and deals page map DB rows through `toModifierConfig`, keep `spicy_level` and `qty` in the cart entry, and price lines with `unitPrice`.
3. `POST /api/checkout`: `CartItem` gains `spicy_level?` and `additions`; inserts `order_items.spicy_level`, `additions`, and `extras` including `qty` and `category`. Sold-out check unchanged (name-based across all extras). Stripe line description uses `formatExtra` and spicy level.
4. Display surfaces show spicy level, additions and `formatExtra`: checkout summary, kitchen (`app/kitchen`, `api/kitchen/*`), dispatch, admin receipt drawer and customer receipt, `lib/printer.ts`, account order history and reorder.

## Testing

- vitest: `lib/order-modifiers.test.ts` (pricing with qty, formatting, legacy fallback, defaults); extend `app/api/checkout/route.test.ts` for the new fields.
- `npx tsc --noEmit` clean.
- Manual, by a human: open an item with modifiers, choose in both modes, add to cart, checkout, confirm kitchen ticket and receipt.

## Workstreams (parallel after the contract lands)

- A: drawer, `ModifierSection`, `QtyStepper`, `app/order/page.tsx`, `app/deals/page.tsx`, `components/Deals/DealSlotPicker.tsx`, `app/api/menu-items/route.ts`.
- B: `app/api/checkout/route.ts` and its test, `app/checkout/page.tsx`.
- C: kitchen page and APIs, dispatch page and API, receipts (customer and admin), `lib/printer.ts`, `app/account/page.tsx`.

File ownership is disjoint so agents do not conflict on the shared working tree.
