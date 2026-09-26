# Customizer: Admin VAT Line (D) and Save Preset (E) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the last two pieces of the Stitch "Your Selection" panel:
- **D:** a "UK VAT included (20%)" line that an admin switches on or off, with the rate set in the admin panel.
- **E:** a "Save Preset" button that lets a signed-in customer save and re-apply their build of an item.

**Architecture:**
- One migration adds `store_settings.show_vat` and `store_settings.vat_rate`, plus a new `item_presets` table protected by row-level security (owner-only).
- Pure helpers in `lib/presets.ts` (VAT maths, preset payload, preset re-application against the item's current options) are unit-tested.
- The customize page reads the VAT setting from the existing public `/api/store-settings` route.
- Presets go through the browser Supabase client (`lib/supabase-browser.ts`) under RLS, the same way `app/account` and `app/checkout` already read the user's own data. No new API route is needed.

**Tech Stack:** Next.js 16.2.7, React 19.2, Supabase (project `nxvtfcfwvqfihqxmtgpc`), Vitest 4 (node env).

**Spec:** the user's answers of 2026-09-26: "VAT: from the admin panel admin can decide", "Save Preset: build and apply migration". The Stitch receipt shows "UK VAT Included (20%) £3.42" under Order Subtotal, and a "Save Preset" button next to "Reset All". Sub-project C (the free-delivery bar) is skipped by the user.

## Global Constraints

- **VAT is information only.** Prices, totals and checkout do not change. The line reads `UK VAT included ({rate}%)`, and its amount is `subtotal × rate / (100 + rate)`, rounded to 2dp. It is hidden unless `show_vat` is true. The defaults `show_vat = false` and `vat_rate = 20` keep today's behaviour until an admin turns it on.
- **Presets never carry prices into an order.** Re-applying a preset maps each saved choice onto the item's current options and uses current prices. It drops any option that is no longer offered or is sold out, and it drops a spicy level the item no longer offers. The selection reaches checkout through the existing path, and the server re-prices everything anyway (`lib/checkout-pricing.ts`).
- **Presets are private to their owner.** RLS on `item_presets` limits select, insert, update and delete to `user_id = auth.uid()`.
- **Limits:**
  - preset names 1–40 characters, unique per user and item (a save with the same name replaces the old preset)
  - notes at most 250 characters (`NOTES_MAX`)
  - at most 10 presets per user and item, enforced in the UI; the Save button hides at 10
- Light theme, brand tokens, and 44px touch targets. The deals popup is untouched.
- Work happens on `master`. Stage only the files listed. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Migration:** the controller, not a subagent, applies it to the live Supabase project with the Supabase MCP `apply_migration`, after its task review. The user has authorized this.

## Review Focus

1. **A preset saved before an option was removed or sold out** must re-apply without that option and without crashing. Pinned by `applyPreset` tests.
2. **A preset holding a stale price**, where the admin has since changed the price, must use the current price. Pinned by `applyPreset` tests.
3. **Signed-out visitors** see "Sign in to save presets", never an error, and the page never throws when the Supabase session read fails. Checked in the Task 3 review and the browser.
4. **VAT maths** at £20.49 and 20% gives £3.42, matching the Stitch figure. `show_vat` false renders no line. Pinned by a `vatIncluded` test and the Task 2 review.
5. **The admin store-settings PATCH** accepts any body today. The new fields must be validated (boolean; rate between 0 and 100) before the update, so a bad rate can't be saved. Pinned by a route test in Task 2.

---

### Task 1: Migration and `lib/presets.ts`

**Files:**
- Create: `supabase/migrations/20260926b_vat_setting_and_item_presets.sql`
- Create: `lib/presets.ts`
- Test: `lib/presets.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PresetPayload {
  spicy: string | null
  removals: string[]
  additions: string[]
  extras: { name: string; category?: string; qty?: number }[]
}
export interface SavedPreset { id: string; name: string; selection: PresetPayload; notes: string | null; qty: number }
export const PRESET_NAME_MAX = 40
export const PRESETS_PER_ITEM_MAX = 10
export function presetPayload(selection: ModifierSelection): PresetPayload
export function applyPreset(config: ModifierConfig, soldOut: string[] | undefined, preset: Pick<SavedPreset, 'selection' | 'notes' | 'qty'>): { selection: ModifierSelection; notes: string; qty: number }
export function vatIncluded(total: number, rate: number): number
export function cleanPresetName(name: string): string | null
```

- [ ] **Step 1: Migration.** Write `supabase/migrations/20260926b_vat_setting_and_item_presets.sql`:

```sql
-- D: admin-controlled "VAT included" line on the customizer receipt (display only).
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS show_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 20
    CHECK (vat_rate >= 0 AND vat_rate <= 100);

-- E: a signed-in customer's saved builds of a menu item.
-- selection holds names only ({spicy, removals, additions, extras:[{name, category, qty}]});
-- prices are always re-read from menu_items when a preset is applied.
CREATE TABLE IF NOT EXISTS item_presets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  selection    jsonb NOT NULL,
  notes        text CHECK (notes IS NULL OR char_length(notes) <= 250),
  qty          integer NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 99),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_item_id, name)
);

CREATE INDEX IF NOT EXISTS item_presets_user_item_idx ON item_presets (user_id, menu_item_id);

ALTER TABLE item_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_presets_select_own ON item_presets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY item_presets_insert_own ON item_presets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY item_presets_update_own ON item_presets FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY item_presets_delete_own ON item_presets FOR DELETE TO authenticated USING (user_id = auth.uid());
```

Before writing it, check that `menu_items.id` is `uuid`: read `supabase/migrations/` for the `menu_items` create statement, or grep for it. If it isn't, match its type and report the change. Do not apply the migration. The controller applies it.

- [ ] **Step 2: Write the failing tests.** Create `lib/presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toModifierConfig } from './order-modifiers'
import { presetPayload, applyPreset, vatIncluded, cleanPresetName } from './presets'

const config = toModifierConfig({
  spicy_levels: [{ name: 'Mild', price: 0 }, { name: 'Reaper', price: 0.5 }],
  ingredients: ['Pickles', 'Cheese'],
  drinks_regular: [{ name: 'Coke', price: 1 }],
  dips: [{ name: 'BBQ', price: 0.75 }],
  additions: ['Napkins'],
})

describe('presetPayload', () => {
  it('stores names, categories and quantities, never prices', () => {
    const p = presetPayload({
      spicy: 'Reaper', removals: ['Pickles'], additions: ['Napkins'],
      extras: [{ name: 'Coke', price: 1, qty: 2, category: 'drinks_regular' }],
    })
    expect(p).toEqual({
      spicy: 'Reaper', removals: ['Pickles'], additions: ['Napkins'],
      extras: [{ name: 'Coke', category: 'drinks_regular', qty: 2 }],
    })
  })
})

describe('applyPreset', () => {
  it('re-applies a preset with current prices', () => {
    const r = applyPreset(config, [], {
      selection: { spicy: 'Reaper', removals: ['Pickles'], additions: ['Napkins'], extras: [{ name: 'Coke', category: 'drinks_regular', qty: 2 }] },
      notes: 'well done', qty: 3,
    })
    expect(r).toEqual({
      selection: { spicy: 'Reaper', removals: ['Pickles'], additions: ['Napkins'], extras: [{ name: 'Coke', price: 1, qty: 2, category: 'drinks_regular' }] },
      notes: 'well done', qty: 3,
    })
  })

  it('drops options no longer offered or sold out, and an unoffered spicy level', () => {
    const r = applyPreset(config, ['BBQ', 'Napkins'], {
      selection: {
        spicy: 'Ghost', removals: ['Pickles', 'Onion'], additions: ['Napkins', 'Straw'],
        extras: [
          { name: 'BBQ', category: 'dips', qty: 1 },
          { name: 'Sprite', category: 'drinks_regular', qty: 1 },
          { name: 'Coke', category: 'sides', qty: 1 },
        ],
      },
      notes: null, qty: 1,
    })
    expect(r).toEqual({ selection: { spicy: null, removals: ['Pickles'], additions: [], extras: [] }, notes: '', qty: 1 })
  })

  it('clamps quantity and keeps only one choice in a single-select category', () => {
    const r = applyPreset(config, [], {
      selection: { spicy: null, removals: [], additions: [], extras: [{ name: 'BBQ', category: 'dips', qty: 5 }] },
      notes: 'x'.repeat(300), qty: 500,
    })
    expect(r.selection.extras).toEqual([{ name: 'BBQ', price: 0.75, qty: 1, category: 'dips' }])
    expect(r.notes.length).toBe(250)
    expect(r.qty).toBe(99)
  })

  it('survives a malformed stored payload', () => {
    const r = applyPreset(config, [], { selection: null as never, notes: null, qty: 1 })
    expect(r.selection).toEqual({ spicy: null, removals: [], additions: [], extras: [] })
  })
})

describe('vatIncluded', () => {
  it('is the VAT portion of a VAT-inclusive total', () => {
    expect(vatIncluded(20.49, 20)).toBe(3.42)
    expect(vatIncluded(10, 0)).toBe(0)
  })
})

describe('cleanPresetName', () => {
  it('trims, rejects empty, caps at 40', () => {
    expect(cleanPresetName('  My Usual  ')).toBe('My Usual')
    expect(cleanPresetName('   ')).toBeNull()
    expect(cleanPresetName('a'.repeat(50))).toBe('a'.repeat(40))
  })
})
```

In a `single`-mode category (dips defaults to single), only the first saved choice survives, with qty 1. In `multi` mode, qty is clamped to 1–20, the same as `QtyStepper`'s max of 20.

- [ ] **Step 3: Run to verify the tests fail.** `npx vitest run lib/presets.test.ts`

- [ ] **Step 4: Implement `lib/presets.ts`.** Import the types `ModifierConfig` from `./order-modifiers` and `ModifierSelection` from `@/components/Menu/ModifierForm`, and `NOTES_MAX` from `./customizer-layout`. Rules:
  - `presetPayload` copies the lists and strips `price` from extras.
  - `applyPreset` treats a non-object `selection` as empty and filters every array with `Array.isArray`.
  - `spicy` is kept only if `config.spicyLevels` has that name.
  - `removals` are kept only if they are in `config.ingredients`.
  - `additions` are kept only if they are in `config.additions` and not sold out.
  - An extra is kept only if its category is found in `config.categories` (`cat.key === extra.category`) with an option of that name that is not sold out. Its price comes from that option. Its qty is `Math.min(20, Math.max(1, Math.floor(qty) || 1))`. For single-mode categories, skip any extra after the first for that category and force qty 1.
  - `notes` is `(notes ?? '').slice(0, NOTES_MAX)`.
  - `qty` is clamped to 1–99, and non-numbers become 1.
  - `vatIncluded` is `Math.round(total * rate / (100 + rate) * 100) / 100`, and 0 when the rate is at or below 0.
  - `cleanPresetName` trims, returns `null` when empty, and otherwise slices to 40.

- [ ] **Step 5:** Run `npx vitest run lib/presets.test.ts` to see it pass. Then run the full `npx vitest run` and `npx tsc --noEmit`.
- [ ] **Step 6:** Commit the three files with the message `feat(customizer): VAT setting + item presets migration, preset helpers`.

---

### Task 2: VAT setting, from admin panel to receipt

**Files:**
- Modify: `app/api/store-settings/route.ts` (the public GET adds `show_vat, vat_rate` to its select)
- Modify: `app/api/admin/store-settings/route.ts` (PATCH validates the new fields)
- Test: `app/api/admin/store-settings/route.test.ts` (create it, or extend an existing test that covers this route; look at `app/api/admin/admin-auth.test.ts` for how it mocks auth and supabase)
- Modify: `app/admin/settings/page.tsx` (a "VAT on receipts" card)
- Modify: `components/Menu/SelectionReceipt.tsx` (optional VAT line)
- Modify: `app/order/customize/[itemId]/page.tsx` (fetch the setting, pass the VAT line)

Requirements:
- **PATCH validation.** When the body contains `show_vat`, it must be a boolean. When it contains `vat_rate`, it must be a finite number with 0 ≤ rate ≤ 100. Otherwise return 400 with `{ error: 'Invalid VAT setting' }` and do not call update. Existing fields pass through unchanged, so current settings behaviour stays the same. The route tests cover a valid VAT patch (update called), a string `vat_rate` (400), a rate of 150 (400), and a non-boolean `show_vat` (400).
- **Admin settings page.**
  - Add a card that matches the existing cards' style on that page. It holds a toggle "Show 'VAT included' on customer receipts" bound to `show_vat`, and a numeric input "VAT rate (%)" bound to `vat_rate` with step 0.01 and range 0–100, saved on blur/enter the same way the prep-time input saves.
  - Helper text: "Display only. Turn on if the business is VAT-registered. Prices are already VAT-inclusive."
  - Use the page's existing `patch()` helper and toast pattern.
- **Receipt.**
  - `SelectionReceipt` gains an optional prop `vat?: { rate: number; amount: number }`. When present, it renders a small zinc line under Order Subtotal: `UK VAT included ({rate}%)`, then `£amount`.
  - Format the rate without trailing zeros: 20 shows as "20", 12.5 as "12.5".
- **Page.** Fetch `/api/store-settings` once. Pass `vat` only when `show_vat === true`, with `amount = vatIncluded(subtotal, Number(vat_rate))`. A failed fetch means no VAT line.
- **Verification:** `npx vitest run`, `npx tsc --noEmit`, and eslint on the touched files with no new findings.
- **Commit** with the message `feat(customizer): admin-controlled VAT-included line on the receipt`.

---

### Task 3: Save Preset UI

**Files:**
- Create: `components/Menu/PresetBar.tsx`
- Modify: `components/Menu/SelectionReceipt.tsx` (a "Save preset" button slot)
- Modify: `app/order/customize/[itemId]/page.tsx`

Requirements:
- **Session.** The page reads the session with `supabase.auth.getSession()` from `@/lib/supabase-browser`, inside try/catch. On any error, treat the visitor as signed out.
- **Signed out.** The receipt shows a secondary link "Sign in to save presets" pointing to `/sign-in`, with a `Heart` icon and `min-h-[44px]`. There is no preset bar.
- **Signed in.**
  - Load `item_presets` rows for this `menu_item_id`, ordered by `created_at` (select `id, name, selection, notes, qty`).
  - `PresetBar`, placed above group 01 when there is at least one preset, shows "Your presets:" followed by one chip per preset: a button with the name, which applies it, plus a separate delete `×` button with `aria-label="Delete preset {name}"`.
  - Applying calls `applyPreset(config, item.sold_out_extras, preset)` and sets the selection, notes and qty. Toast "Preset applied" (react-hot-toast, already used in the app). If any saved option was dropped, say so: "Preset applied — some options are no longer available".
  - Delete calls `.delete().eq('id', id)`, then reloads the list.
- **Save.**
  - The receipt's "Save preset" button (`Heart` icon, secondary style next to "Reset all") opens an inline form inside the receipt. It has a name input (maxLength 40, `aria-label="Preset name"`), Save and Cancel.
  - Save runs `cleanPresetName`, then upserts `{ menu_item_id, name, selection: presetPayload(selection), notes: notes.trim() || null, qty }` with `onConflict: 'user_id,menu_item_id,name'`. `user_id` defaults on the server via `auth.uid()`, so don't send it.
  - On success: toast "Preset saved", close the form, reload the list.
  - On error: toast the error message; don't throw.
  - Hide the Save button when there are already `PRESETS_PER_ITEM_MAX` presets for this item, unless the name matches an existing one, which replaces it.
- **Mobile.** On mobile the receipt shows below the groups with `showActions={false}`. Make the Save preset / Sign in control visible there too, as it is part of the receipt, not the primary CTA.
- **Verification:**
  - `npx tsc --noEmit`, `npx vitest run`, and eslint with no new findings.
  - Browser, signed out: the sign-in link shows and nothing errors.
  - Signed-in testing needs a real account. If none is available, report that it wasn't browser-tested signed in, and say so.
- **Commit** with the message `feat(customizer): save and re-apply item presets`.

---

### Task 4 (controller): apply migration, final checks

- [ ] After Task 1's review, apply `20260926b_vat_setting_and_item_presets.sql` with Supabase MCP `apply_migration` to project `nxvtfcfwvqfihqxmtgpc` (name `vat_setting_and_item_presets`).
- [ ] Verify with `execute_sql`: the columns exist, `item_presets` has RLS enabled, and there are 4 policies. Run `get_advisors` (security) and report any new warning.
- [ ] Final whole-branch review of both plans (Claude Opus), plus a Gemini deep-review second opinion. Then one fix wave and a graphify refresh.
