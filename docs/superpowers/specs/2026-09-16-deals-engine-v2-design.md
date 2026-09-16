# Deals Engine v2 — Admin Slot Builder + Customer Deal-to-Cart

## Context

The deals engine shipped 2026-09-15 (`docs/superpowers/specs/2026-09-15-generalized-deals-engine-design.md`)
supports 4 deal types (`bogo`, `bundle`, `fixed_meal`, `order_discount`) with
automatic matching against whatever's in the cart. Bundle-product association
today is *implicit*: a product opts into a bundle by having its
`combo_category`/`size_tier` set on the product edit form, and the bundle's
`config.groups[i].category` matches against that tag.

This round moves deal↔product association to be *explicit* and *admin-driven*
from the Deals panel itself, replacing the product-side tagging, and gives
customers a dedicated way to build & add a bundle deal from the front end
(rather than only relying on auto-detection at checkout). Reference pattern:
a sibling project's `/admin/deals` slot builder and `/deals` "build this deal"
customer flow (screenshotted into `E:\AIStudio\Document.rtf`, reviewed live at
`127.0.0.1:3030`).

## Goals

- Admin builds a bundle deal by picking slots (label, min/max qty, explicit
  item list) — no product-side tagging.
- Bundle deals get scheduling (`available_from`/`until`), an optional image,
  and an optional custom badge label.
- Customer sees an `OFFER` badge on any product that's part of an active
  deal. If the deal is a bundle, a second "Deal to Cart" button opens a
  slot-picker matching ChickenTime's existing pill/stepper visual language
  (not a bare checkbox grid).
- A `/deals` gallery page lists active bundle deals with a "Build this deal"
  entry point into the same picker.
- Remove now-dead product-side deal tagging (`combo_category`, `size_tier`)
  and the `fixed_meal` deal type (subsumed by bundle; no live rows).

## Non-goals

- No change to BOGO / order_discount matching logic (still fully automatic,
  no popup — they have nothing to "build").
- No new cart-item shape. Deal-picked items still land as ordinary cart lines;
  `matchDeals` (unchanged matching algorithm) recognizes them from the
  existing cart the same way it does today.
- No multi-currency/multi-location scheduling — `available_from`/`until` are
  plain UTC timestamps, store-wide.

## Data model

```sql
-- supabase/migrations/20260917_deals_v2.sql

ALTER TABLE deals
  ADD COLUMN available_from  TIMESTAMPTZ,
  ADD COLUMN available_until TIMESTAMPTZ,
  ADD COLUMN image_url       TEXT,
  ADD COLUMN custom_label    TEXT;

-- Migrate the 2 live bundle deals (Medium/Large Meal Deal) from
-- {label, category, pick_qty} groups to {label, min_qty, max_qty, item_ids}.
-- item_ids resolved from the current category membership at migration time
-- (a snapshot — future menu changes no longer auto-affect these deals,
-- which is the point: assignment is now explicit).
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

`fixed_meal` stays a dormant value in the `deal_type` Postgres enum (dropping
an enum value requires recreating the type; not worth the risk for a value
the app will simply never write or read again).

## Types & validation (`lib/deal-engine.ts`, `app/api/admin/deals/route.ts`)

```ts
interface BundleConfig {
  groups: { label: string; min_qty: number; max_qty: number; item_ids: string[] }[]
  price: number
}
```

- `evaluateItemDeal`'s bundle branch: pool = `available.filter(u => group.item_ids.includes(u.menu_item_id))`.
  Fails the group (whole deal) if pool size `< min_qty`. Consumes best-price-first
  **exactly `min_qty`** units — not up to `max_qty`. (Architect review caught
  a real pricing bug in the up-to-`max_qty` version: since `price` is fixed
  per bundle regardless of how many units within range are consumed, savings
  strictly increases with more units consumed, so the greedy matcher would
  always grab `max_qty` whenever the cart happened to have enough matching
  units — silently awarding a bigger discount than the customer ever chose
  in `DealSlotPicker`. Pegging consumption/savings to `min_qty` closes that;
  `max_qty` remains purely a `DealSlotPicker` UX constraint — how many items
  the customer may select from that slot when building the bundle — with no
  effect on automatic matching.)
- `fixed_meal` branch and `FixedMealConfig` type deleted. `VALID_TYPES` in the
  admin route drops to `['bogo', 'bundle', 'order_discount']`.
- `validateConfig`'s bundle case validates `min_qty >= 0`, `max_qty >= min_qty`,
  `item_ids` non-empty array of strings.
- New shared helper in `deal-engine.ts`:
  ```ts
  export function isDealLive(deal: { is_active: boolean; available_from?: string | null; available_until?: string | null }, now = new Date()): boolean
  ```
  used by all three read sites below instead of each re-deriving the window
  check.

## Read sites needing the schedule check

`app/api/deals/active/route.ts`, `app/api/deals/quote/route.ts`,
`app/api/checkout/route.ts` all currently filter `.eq('is_active', true)`
only. Each adds `available_from`/`available_until` to its `.select()` and
filters the fetched rows through `isDealLive` before use (kept as a JS
post-filter rather than SQL, since the dataset is small and it avoids
three copies of null-aware date-range SQL).

## `combo_category`/`size_tier` read sites (blocker — verified by validation pass)

The column drop in the migration above breaks any query that still selects
these columns. Beyond the product edit modal, they're read in:

- **`app/api/menu-items/route.ts:9`** — `.select()` explicitly includes
  `combo_category, size_tier`. This is the public menu API backing
  `/order`, `/deals`, and `ItemCustomizerDrawer` — **will hard-fail on every
  request** ("column does not exist") the moment the migration runs unless
  this query is updated in the same deploy. Highest-priority item in this
  spec.
- **`app/api/admin/menu-items/[id]/route.ts:37`** — PUT allowlist still
  includes `'combo_category'`, `'size_tier'`; remove alongside the
  `app/admin/page.tsx` form-field removal.
- **`app/api/checkout/route.ts:20`** — has a `size_tier: 'regular' | 'large'`
  type field; remove.
- **`app/order/page.tsx:26-27,251-252,279-280`** — independent
  `combo_category`/`size_tier` type fields and mapping, separate from the
  admin form; becomes dead code, remove.
- **`components/Menu/ItemCustomizerDrawer.tsx:14,26`** — has its own
  `size_tier`/`combo_category` type fields distinct from the "Make it a
  Meal" block covered below; remove.

**Deploy ordering:** app code must stop selecting/writing these columns
*before* the migration drops them (deploy app changes first, confirm clean,
then run the migration) — not the other way around, or the app breaks in
the gap between migration and deploy.

## Admin — Deals panel (`app/admin/deals/page.tsx`)

- `TYPE_LABELS`/`EMPTY_CONFIG` drop `fixed_meal`; type dropdown becomes 3 options.
- New top-level fields on the deal form (outside `config`, own columns):
  Custom Label (optional, placeholder "Leave blank to use the default label"),
  Available From / Available Until (datetime-local inputs, optional), Deal
  Image (file upload → reuse the existing `app/api/admin/menu/upload/route.ts`
  helper — POST, multipart `FormData`, uploads to the Supabase storage
  bucket `menu-images`, returns `{url}`; already called from
  `app/admin/page.tsx:368` for menu-item images — same pattern, don't build
  a second upload route).
- Bundle form's slot editor (`config.groups`) replaced:
  - Per slot: Label, Min Qty, Max Qty, Required (derived display only —
    `min_qty > 0`; no separate stored flag, avoids a field that can
    contradict `min_qty`), and an item picker: search box + category filter
    dropdown + checkbox list (reuse `/api/admin/menu-items` data already
    fetched elsewhere on this page's sibling menu-manager page — fetch once,
    filter client-side, matches the reference's "Find item... / All
    Categories" pattern).
  - "+ Add slot" / delete slot unchanged in spirit.
- `app/admin/page.tsx` (product edit modal): delete the "Combo Role" and
  "Size Tier" form fields, their state, and their submit payload keys.

## Customer front end

### `DealSlotPicker` component (new, `components/Deals/DealSlotPicker.tsx`)

Replaces `BundleGroupPicker` (renamed — same file deleted, this is not an
incremental edit since the selection model changes from fixed `pick_qty` to
a `min_qty`–`max_qty` range). Visual language: reuse the pill/stepper
patterns already in `ItemCustomizerDrawer` (radio-style pills for choices,
`-`/`+` steppers where multiple of the same item can be picked within a
slot) rather than the reference's plain checkbox grid — keeps it consistent
with the rest of the ordering flow.

- Props: `{ deal: Deal, itemsById: Map<string, MenuItemLite & {name, image_url, extras: {name, price}[] | null, removals: string[] | null, additions: string[] | null}>, onComplete: (picks: {item_id: string; qty: number; removals: string[]; additions: string[]; extras: {name, price}[]}[]) => void }`.
  (`extras`/`removals`/`additions` are the same fields `menu_items` and
  `ItemCustomizerDrawer` already use — no new modifier concept, just carrying
  the existing one through the slot picker.)
- Per slot: shows picked-count vs `min_qty`–`max_qty`, pill grid of that
  slot's `item_ids`, steppers if `max_qty > 1` for a single item allows more
  than 1 of the same pick (matches ChickenTime's existing extras UX).
- If the picked item has any non-empty `extras`/`removals`/`additions`,
  picking its pill opens `ItemCustomizerDrawer` for that single item (same
  component used everywhere else) instead of incrementing the slot count
  directly — confirming the drawer adds that configured line to the slot.
  Items with no customization options (e.g. a can of drink) just toggle/step
  in place, no drawer. Editing an already-picked customized item re-opens
  the drawer on its current selection.
- Submit enabled once every slot's picked count is within `[min_qty, max_qty]`.
- `onComplete` payload is `{item_id, qty, removals, additions, extras}[]` —
  caller pushes each straight through the existing `handleAddToOrder` cart
  path (`app/order/page.tsx`), which already accepts exactly this shape.
  Deal savings math is untouched: `matchDeals` prices bundles off
  `menu_items.price` only, so chosen extras still cost extra on top of the
  bundle price, same as they would on a standalone add-to-cart — no engine
  change needed here.

### Product card (order page)

- Fetch `/api/deals/active` once per page load (already done by
  `ItemCustomizerDrawer` today — moves up to the order page/grid level so
  every card can check membership, not just the drawer).
- A product is "in a deal" if its id appears in any active bundle's
  `item_ids`, matches a BOGO `buy`/`get` ref, or matches an order_discount
  category scope.
- `OFFER` badge shows for any match (all deal types).
- If the item is in **at least one bundle** deal: render "Add to Cart" +
  "Deal to Cart". "Deal to Cart" opens `DealSlotPicker` for that bundle (if
  the item matches more than one active bundle, open a small chooser first —
  edge case, low priority, simplest correct behavior: list matching deal
  names, pick one, then open the picker).
- If the item only matches BOGO/order_discount (no bundle): badge shows,
  single "Add to Cart" button only (nothing to configure — these still
  auto-apply at checkout exactly as today).

### `ItemCustomizerDrawer`

- Delete the "Make it a Meal" block entirely: the `matchingBundle` state,
  the `/api/deals/active` fetch inside the drawer, `BundleGroupPicker` import,
  and the associated JSX section. The badge/button on the card is now the
  only discovery path for bundles.

### `/deals` page (`app/deals/page.tsx` — already exists, this is a rewrite in place, not a new file)

`app/deals/page.tsx` currently exists, works, and uses `BundleGroupPicker`
+ still references `fixed_meal` — it needs updating alongside the
component swap, not creating from scratch.

- Public page, fetches `/api/deals/active`, filters to `type === 'bundle'`.
- Cards: deal image (fallback to a generic placeholder if `image_url` is
  null), name, `custom_label` badge (or auto-label from type if none set),
  description-equivalent (list of slot labels, e.g. "2× Pizza, 1× Starter"),
  price, "Build this deal" button opening the same `DealSlotPicker`.
- Nav: add a "Deals" link (site header, wherever Menu/Order links already
  live).

## Removed

- `combo_category`, `size_tier` columns on `menu_items`, and every read/write
  site listed above (`app/api/menu-items/route.ts`,
  `app/api/admin/menu-items/[id]/route.ts`, `app/api/checkout/route.ts`,
  `app/order/page.tsx`, `ItemCustomizerDrawer.tsx`'s own type fields), plus
  the "Combo Role" / "Size Tier" fields in the product edit modal.
- `fixed_meal` deal type: `FixedMealConfig`, its `evaluateItemDeal` branch,
  its admin form section, `VALID_TYPES` entry.
- `ItemCustomizerDrawer`'s "Make it a Meal" block.
- `components/Deals/BundleGroupPicker.tsx` (replaced by `DealSlotPicker.tsx`).

## Testing

- `lib/deal-engine.test.ts`: rewrite bundle fixtures to the new
  `{label, min_qty, max_qty, item_ids}` shape; add a min≠max range case
  proving the engine consumes exactly `min_qty` (best-price-first) even when
  more matching units than `max_qty` are sitting in the cart — this is the
  regression test for the discount-inflation bug the architect review
  caught; add an `isDealLive` unit test covering before/during/after a
  scheduling window and the null (always-live) case. Delete `fixed_meal`
  fixtures/cases.
- New `DealSlotPicker` test: completion gating respects per-slot
  `[min_qty, max_qty]`, `onComplete` payload shape, and that picking an item
  with non-empty `extras`/`removals`/`additions` routes through
  `ItemCustomizerDrawer` before it counts toward the slot (vs. a plain item
  incrementing directly).
- Manual pass (dev server): admin slot builder create/edit/delete a bundle
  with 2+ slots and item search; product card badge + dual buttons on a
  bundled item vs single button on a BOGO-only item; picking a customizable
  item inside a slot (e.g. a chicken piece with sauce/removal options) opens
  its customizer and the choice survives into the cart line; `/deals`
  gallery → build → cart shows matched discount at quote; scheduled deal
  outside its window doesn't show anywhere.

## Migration risk

Single migration file, runs once against the linked Supabase project
(`supabase db query --linked --file ...`, same method used for the RLS fix
this session — `db push` is broken against this project's migration history
and out of scope to repair here). The bundle-group backfill is
best-effort/inspectable (a `SELECT` before running lets you sanity-check
which items each group would resolve to); if it produces an empty
`item_ids` for a group, that deal simply won't match anything until an
admin fixes it in the new slot builder — not a data-loss risk, worst case
is a temporarily-inactive-looking bundle.
