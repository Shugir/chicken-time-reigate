# Item Customizer Overhaul — Phase 1: DB Schema & Admin Overhaul

Parent feature: "Advanced Product & Deal Customizer UI" (image_54bc22.png reference, "MINI MIX TWO" popup). Full 4-phase plan was produced by a dedicated Architect pass; this document scopes **only Phase 1** (DB + Admin), which must ship and be verified before Phase 2 (customer UI), Phase 3 (deal hybrid), and Phase 4 (cart/checkout/printer/KDS) begin. Those later phases are out of scope for this plan file — do not implement them here.

No formal spec doc exists for this feature; this plan is the binding source of requirements for Phase 1, argued from the user's verbatim feature request (categorized modifier arrays on `menu_items`) plus four explicit approvals given during planning (see Global Constraints). Rulings made without a separate spec doc are treated as authoritative for this plan.

## Context

Repo: `E:\ChickenTime\chicken-time-reigate`. Next.js + Supabase. Working directly on `master` — this repo's established convention (no feature branches; prior multi-task SDD plans, e.g. the Deals Engine v2 plan, shipped the same way). Continue that convention here; do not create a branch or worktree.

Today `menu_items` has exactly ONE flat `extras JSONB {name,price}[]` bucket (paid), ONE flat `removals text[]` (free, deselect-to-remove), ONE flat `additions text[]` (free, currently broken downstream — out of scope for Phase 1, fixed in Phase 4). No categorization of modifiers exists anywhere. The Admin product form (`app/admin/page.tsx`) mirrors this with one UI section per flat array.

Phase 1 replaces this with 11 new columns supporting: a configurable spicy-level list, an "included ingredients" list (customer deselects), and 8 explicitly separate, individually-priced modifier categories (`add_ons`, `drinks_regular`, `drinks_large`, `dips`, `sides`, `fries_regular`, `fries_large`, `other_extras`), plus a per-category select-mode setting (single-select pill vs multi-select stepper), admin-configurable per product.

## Global Constraints

These bind every task in this plan. Copied verbatim from the approved architecture pass:

1. **Schema shape: flat columns on `menu_items`, not a new table, not one generic JSONB blob.** `spicy_levels text[] DEFAULT '{}'`, `ingredients text[] DEFAULT '{}'` (supersedes `removals` conceptually), and 8 priced category columns `add_ons`, `drinks_regular`, `drinks_large`, `dips`, `sides`, `fries_regular`, `fries_large`, `other_extras` — each `JSONB DEFAULT '[]'`, each element shaped `{name: string, price: number}` (same shape as the existing `Extra` interface in `app/admin/page.tsx:25-28`).
2. **Legacy columns (`extras`, `removals`, `additions`) are kept, frozen, not dropped.** Backfill once at migration time only: `ingredients ← removals`, `add_ons ← extras`. After this migration ships, nothing in Phase 1 writes to `extras`/`removals` again (Admin form stops writing them). Do not null them out — omit from payload, don't destroy existing data.
3. **Free vs. priced entries within one category: inferred from `price === 0`, no separate `is_free`/`display_mode` field.** (This governs Phase 2/3 rendering, not Phase 1's schema — but the schema must NOT add a flag for this; keep every priced-category column's element shape exactly `{name, price}`, nothing more.)
4. **Select-mode (pill single-select vs stepper multi-select) is per-category AND admin-configurable per product** (this diverges from the Architect's own default recommendation of a fixed global convention — the user explicitly chose configurable). Add ONE new column: `modifier_select_modes JSONB DEFAULT '{"spicy_levels":"single","dips":"single","fries_regular":"single","fries_large":"single","add_ons":"multi","drinks_regular":"multi","drinks_large":"multi","sides":"multi","other_extras":"multi"}'` — a JSON object keyed by category name, each value `"single"` or `"multi"`. These defaults match the reference image's own layout (spicy/dips/fries as single-select pills, everything else as multi-select steppers) so existing/new products get sensible behavior with no admin action required, while remaining editable per product. `ingredients` has no select-mode entry — it's always a deselectable-pill list, never single-select (that would contradict its "included by default" semantics).
5. **`order_items.combo_components` dead-code check**: before finalizing the `order_items` migration, query `SELECT count(*) FROM order_items WHERE combo_components IS NOT NULL AND combo_components != '[]'::jsonb;`. If the count is 0, include `DROP COLUMN combo_components` in the `order_items` migration. If nonzero, do NOT drop it — leave it untouched and note the nonzero count in the task report; it becomes a separate cleanup decision, not part of this feature.
6. **Sold-out matching**: the existing `sold_out_extras text[]` column (name-based exclusion set) is reused unchanged — no schema change. Its matching semantics broaden from "match against `extras`" to "match against the union of all 8 priced category columns." Document this broadened contract with a one-line comment at its point of use in the admin save handler. If the admin form allows the same name in two different categories, that's a real ambiguity for this exclusion set — Task 3 must add a non-blocking warning (not a hard validation error) when a name is duplicated across categories.
7. **`Extra` TypeScript interface stays** (rename target `PricedModifier` was suggested but is NOT required for Phase 1 — do not rename it or introduce a parallel type; reuse `Extra` for all 8 new priced-category arrays to minimize churn). The `MenuItem` interface gains the 11 new fields; mark `extras`/`removals` with a `/** @deprecated */` JSDoc comment, do not remove them.
8. **Do not touch**: `app/api/checkout/route.ts`, `lib/printer.ts`, `app/kitchen/page.tsx`, `app/admin/dispatch/page.tsx`, `components/Menu/ItemCustomizerDrawer.tsx`, `components/Deals/DealSlotPicker.tsx`, `components/ProductModal.tsx`. These are Phase 2/3/4 scope. Phase 1 only touches migrations, `app/admin/page.tsx`, and the `/api/admin/menu-items` routes.
9. **Migrations are applied to the live Supabase project** via the Supabase MCP tools (this repo's established practice — prior features' migrations were applied to prod directly, per project history). `ADD COLUMN ... DEFAULT ...` statements are additive/reversible and low-risk; the conditional `combo_components` drop is the only irreversible statement in this plan and is gated by the row-count check in constraint 5 — if the implementer is in any doubt about the count result, it must stop and report rather than guess.

## Tasks

### Task 1: `menu_items` modifier-category migration

Create `supabase/migrations/20260921a_menu_item_modifier_categories.sql`:

```sql
ALTER TABLE menu_items
  ADD COLUMN spicy_levels text[] DEFAULT '{}',
  ADD COLUMN ingredients text[] DEFAULT '{}',
  ADD COLUMN add_ons JSONB DEFAULT '[]',
  ADD COLUMN drinks_regular JSONB DEFAULT '[]',
  ADD COLUMN drinks_large JSONB DEFAULT '[]',
  ADD COLUMN dips JSONB DEFAULT '[]',
  ADD COLUMN sides JSONB DEFAULT '[]',
  ADD COLUMN fries_regular JSONB DEFAULT '[]',
  ADD COLUMN fries_large JSONB DEFAULT '[]',
  ADD COLUMN other_extras JSONB DEFAULT '[]',
  ADD COLUMN modifier_select_modes JSONB DEFAULT '{"spicy_levels":"single","dips":"single","fries_regular":"single","fries_large":"single","add_ons":"multi","drinks_regular":"multi","drinks_large":"multi","sides":"multi","other_extras":"multi"}';

UPDATE menu_items SET ingredients = removals WHERE removals IS NOT NULL;
UPDATE menu_items SET add_ons = extras WHERE extras IS NOT NULL;
```

Use the Supabase MCP `apply_migration` tool (name: `20260921a_menu_item_modifier_categories`) to run this against the live project — do not just write the file, actually apply it, then verify with a `list_tables`/`execute_sql` describe of `menu_items` showing all 11 new columns present. After confirming, also write the same SQL to the migrations file in the repo (`supabase/migrations/20260921a_menu_item_modifier_categories.sql`) so it's tracked in version control, and `git add` it (do not commit yet — Task 4 makes the single commit covering all of Phase 1, OR commit per-task if that's how this repo's history shows prior SDD plans working — check `git log --oneline -20` for the pattern used in the Deals Engine v2 plan and follow it).

Verify: query `information_schema.columns` for `menu_items` and confirm all 11 new columns exist with correct types/defaults. Confirm the two `UPDATE` backfills ran without error (spot-check 2-3 existing rows that had non-empty `extras`/`removals` now have matching `add_ons`/`ingredients`).

Report file contract: state the exact migration name used, paste the `apply_migration` tool result, and paste the verification query output.

### Task 2: `order_items` migration + `combo_components` conditional drop

First, run the row-count check from Global Constraint 5 via the Supabase MCP `execute_sql` tool (read-only): `SELECT count(*) FROM order_items WHERE combo_components IS NOT NULL AND combo_components != '[]'::jsonb;`

Then create `supabase/migrations/20260921b_order_items_modifier_fields.sql`:

```sql
ALTER TABLE order_items
  ADD COLUMN spicy_level TEXT,
  ADD COLUMN additions JSONB DEFAULT '[]';
```

If the row-count check returned 0, append `, DROP COLUMN combo_components` to the same `ALTER TABLE order_items` statement (single statement, both changes). If nonzero, leave `combo_components` untouched and state the exact count in the report.

Apply via Supabase MCP `apply_migration` (name: `20260921b_order_items_modifier_fields`), verify via `information_schema.columns` that `order_items` now has `spicy_level` and `additions`, and (if dropped) confirm `combo_components` no longer appears. Write the file to the repo migrations directory same as Task 1.

Note: `order_items.extras` JSONB column is NOT touched by this migration — its richer per-element shape (`qty`, `category` fields) is a Phase 4 application-layer change only, no schema change needed since it's already untyped JSONB. Do not modify `order_items.extras` or `order_items.removals` in this task.

Report file contract: state the row-count check result and whether `combo_components` was dropped or left, paste both tool results (count query + apply_migration), and paste the verification query output.

### Task 3: Admin form — types + `ItemModal` categorized sections

Depends on Task 1 (columns must exist). File: `app/admin/page.tsx`.

1. Extend the `MenuItem` interface (currently ~line 30-46) with the 11 new fields: `spicy_levels: string[]`, `ingredients: string[]`, `add_ons: Extra[]`, `drinks_regular: Extra[]`, `drinks_large: Extra[]`, `dips: Extra[]`, `sides: Extra[]`, `fries_regular: Extra[]`, `fries_large: Extra[]`, `other_extras: Extra[]`, `modifier_select_modes: Record<string, 'single'|'multi'>`. Add `/** @deprecated use ingredients */` above `removals` and `/** @deprecated use add_ons */` above `extras` — do not remove either field.
2. In the `ItemModal` component (~line 257-763):
   - Add state for all 11 new fields, initialized from the item being edited (or empty defaults / the default `modifier_select_modes` object from the migration when creating a new item).
   - Replace the "Removable Ingredients" section (~541-575) with an "Ingredients" section using the same UI pattern but bound to `ingredients` state instead of `removals`.
   - Add a new "Spicy Levels" section (free-text tag add/remove list), structurally mirroring the existing "Add Ingredients" section's UI pattern (~577-611) — same add/remove chip interaction, no pricing.
   - Replace the single "Priced Extras" section (~613-672) with 8 sections, one per priced category (`Add-ons`, `Drinks (Regular)`, `Drinks (Large)`, `Dips`, `Sides`, `Fries (Regular)`, `Fries (Large)`, `Other Extras`) — each is a mechanical copy of the existing Priced Extras section's add/remove/name/price/sold-out-toggle UI, bound to its own state array. Keep the existing sold-out-toggle behavior per Global Constraint 6, but broaden the matching set: when toggling sold-out for a name, check/set membership against the union of all 8 category arrays' names, not just `add_ons`.
   - For each of the 9 categories that has a select-mode (everything except `ingredients` — i.e. `spicy_levels` + the 8 priced categories), add a small inline toggle/select control ("Pill (single-select)" / "Stepper (multi-select)") next to that section's header, bound to `modifier_select_modes[categoryKey]`, defaulting to the value from the loaded item (or the migration's default object for a new item).
   - Add the non-blocking duplicate-name warning from Global Constraint 6: when a name being added to any of the 8 priced categories (or `ingredients`) already exists in a different category, show an inline warning (not a validation error, does not block save) noting the name is used in `sold_out_extras`-relevant category X too.
   - Update `handleSubmit` (~350-405): the payload gains all 11 new fields (including `modifier_select_modes` as a plain object). Continue to OMIT `extras`/`removals` from the payload going forward (per Global Constraint 2) rather than sending them as empty/null.
3. Keep the `Extra` interface as-is (Global Constraint 7) — reuse it for every new priced-category array's type.

Verify: `npx tsc --noEmit` (or this repo's existing typecheck script — check `package.json`) passes with no new errors. Manually trace `handleSubmit`'s payload construction to confirm all 11 fields are present and `extras`/`removals` are absent from the outgoing payload.

Report file contract: list every new state variable added, confirm typecheck output, and paste the final `payload` object shape (as constructed in `handleSubmit`) verbatim.

### Task 4: `/api/admin/menu-items` routes — accept new fields

Depends on Task 3 (matches the payload shape it produces). Files: `app/api/admin/menu-items/route.ts` and `app/api/admin/menu-items/[id]/route.ts` (or wherever the POST/PATCH handlers live — locate via the import in `app/admin/page.tsx`'s `handleSubmit`).

These routes are today a pass-through insert/update (per the Researcher's findings — confirm this is still true by reading them first). Extend whatever explicit field list or type they use (if any) to include the 11 new fields so they're persisted on both create (POST) and update (PATCH). If the routes already do an unfiltered `req.json()` spread into the Supabase insert/update (no explicit allowlist), no code change may be needed beyond confirming that's the case — if so, report that the task required no changes and explain why, backed by the actual route code read.

Verify end-to-end: using the Supabase MCP `execute_sql` (read-only) or the admin UI itself, confirm a test product edit round-trips all 11 new fields correctly (write a value, read it back). If manual UI testing isn't feasible from this environment, verify via a direct `execute_sql` insert/select round-trip against a scratch/test row instead, and note that a human should confirm the actual Admin UI round-trip separately before Phase 2 begins.

Report file contract: state whether the routes needed code changes or already pass through unfiltered, paste the relevant route code, and paste the round-trip verification result.

## Out of scope (explicitly, for the task-reviewer's benefit)

Do not implement any of: Phase 2 (`ItemCustomizerDrawer.tsx` rebuild), Phase 3 (`DealSlotPicker.tsx` hybrid), Phase 4 (cart/checkout/printer/KDS). Do not fix the `additions`-dropped-at-checkout bug (Phase 4). Do not build `ModifierSection.tsx`, `QtyStepper.tsx`, or `PaidUpsellSections.tsx` (Phase 2/3). A task reviewer flagging "the new columns aren't consumed by any customer-facing UI yet" is a correct observation but NOT a defect — that's Phase 2's job, ledger it as expected/deferred, not a finding to fix here.
