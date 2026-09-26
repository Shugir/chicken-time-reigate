# Admin Menu Item Editor as a Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the Menu Manager's "New menu item" / "Edit item" modal (`ItemModal` in `app/admin/page.tsx`) with full pages, `/admin/menu/new` and `/admin/menu/[id]`. The form follows the same order and numbering as the customer's store customizer. The plan also fixes the gaps found while reviewing the editor.

**Owner request (2026-09-26):** "New menu item" and "Edit item" should not be a pop-up. They should be pages, restructured to follow the Store customizer page order, reviewed with the apple-design skill. "Think what else is missing, and fix it or create it."

**Tech:** Next.js 16.2.7 App Router (client components, `useParams`, `useRouter`), React 19, Tailwind 4, Supabase, Vitest (node env). The admin area uses a dark theme (`bg-zinc-950`, zinc-900 cards), which stays.

## Design (apple-design review, applied)

**Thesis:** one screen where the manager builds exactly what the customer will see, in the customer's own order. **Signature element:** the numbered outline (01 Item Customize … 07 Other Extras) matches the store's numbering, so "1.3" means the same thing to the manager as to the customer.

- **Page, not modal.** `modality.md`: modality "requires an explicit action to dismiss" and suits short, self-contained tasks. Building a menu item is long, multi-section work. A page gives it a URL, reload-safety and browser Back.
- **Protect unsaved work.** `sheets.md › Best practices`: "If people have unsaved changes … let them confirm their action." `file-management.md`: "make sure people know when a document has unsaved changes." The page shows an "Unsaved changes" badge, and Back or leaving asks to confirm.
- **Prevent mistakes.** `entering-data.md`: "design ways that make it easy for them to provide it without making mistakes." Errors show inline next to the field that caused them, with `aria-invalid` and `aria-describedby`, and focus moves to the first bad field. The server validates too.
- **Layout.** Two columns on desktop: the form (`lg:col-span-8`), and a sticky side panel (`lg:col-span-4`) with a live preview and the actions. One column on mobile, with a sticky bottom action bar. This mirrors the customer page.
- **Accessibility floor:**
  - Controls at least 44px (`h-11`).
  - Visible `focus-visible:ring-2 ring-brand-red`.
  - Contrast:
    - white on #1A1A1A: 17.4:1
    - white on #626262: 6.1:1
    - zinc-400 (#a1a1aa) on zinc-900 (#18181b): 7.0:1
  - Every icon-only button has an `aria-label`.

## Page structure (top to bottom)

1. **Top bar**, sticky on scroll:
   - "← Menu Manager" back link
   - title "New menu item" or "Edit item" with the item name under it
   - "Unsaved changes" badge when the form is dirty
   - desktop only: Cancel, then **Save changes** (or **Add item**)
2. **Basics** card, mirroring the store hero:
   - Photo: 4:3 preview, upload, or URL, as today
   - Name, Description, Price, Compare-at price with the offer explanation, Category
   - **Available on the menu** toggle (new here; today it only exists in the list)
3. **Dietary & allergens** card (dietary flag pills and allergen tags, as today). The store shows allergens in its hero, so this card comes before the options.
4. **Customer options**, in store order, each group in a card with a #1A1A1A header bar and a red number chip. Sub-sections use #626262 bars with white text, like the store:
   - **01 Item Customize:** 1.1 Spicy Level, 1.2 Ingredients (tag list, "included, customers can remove"), 1.3 Extra Ingredients (priced list, £0.00 = free)
   - **02 Drinks:** 2.1 Regular Drinks, 2.2 Large Drinks
   - **03 Sides**
   - **04 Fries:** 4.1 Regular Fries, 4.2 Large Fries
   - **05 Dips**
   - **06 Add-ons**
   - **07 Other Extras**

   Each priced list keeps its current editor: option rows with price, description and badge, sold-out ("86"), rename, and suggestions. It also keeps the Choose one / Tick several / Tick + quantity picker. Spicy keeps its own rules.

   The admin always shows all 7 groups, so the manager can fill any of them. A small note says: "Empty groups are hidden from customers and the rest renumber." Each group header shows a count ("3 options"), and empty groups are collapsed, using the existing `Disclosure` behaviour.
5. **Danger zone** (edit only): **Delete item**, confirmed by typing nothing extra, using the existing `DeleteConfirmModal` pattern. A delete confirm dialog is the one place modality is right.

**Side panel** (sticky on desktop, placed after Basics on mobile):
- **Live preview** card: 4:3 photo, name, price, and a crossed-out compare-at price with an OFFER tag when it is higher, looking the way the store card does.
- **"Customer page"** outline: the numbered groups the customer will actually see. It comes from `customizerLayout(toModifierConfig(draft))` in `lib/customizer-layout.ts`, so it uses real gap-free numbering (e.g. "01 Item Customize · 1.1 Spicy (4) · 1.3 Extras (6)"), plus "08 Special Instructions" and "09 Your Selection". "Simple item: adds straight to the bag" shows when `hasNoCustomization`.
- On edit: **View on store** (opens `/order/customize/<id>` in a new tab) and **Duplicate** (goes to `/admin/menu/new?from=<id>`, prefilled with the name plus " (copy)"). Then Cancel and Save on desktop.

**Mobile:** a sticky bottom bar with Cancel and Save, padded for the safe area.

**After saving:** go to `/admin?saved=<name>`. The list page shows a toast "Saved <name>" and removes the query. When an item is created, the page redirects there too.

## "What else is missing", found and fixed here

1. **Bug.** `POST /api/admin/menu-items` ignores `compare_at_price`, so a new item's offer price is silently lost.
2. **Missing server validation on create and update.** No checks on price type or range, `compare_at_price`, empty name, or unknown `modifier_select_modes` values (only `single`, `multi` and `pick` are valid). Option entries are also unchecked (name must be a non-empty string, price a finite number ≥ 0). Add one tested validator, used by both routes.
3. `POST` logs the whole payload with `console.log`. Remove it.
4. There is no route to load a single item. Add `GET /api/admin/menu-items/[id]`, MenuManager-only, 404 when missing.
5. Availability can't be changed while editing. Added to Basics.
6. There is no unsaved-changes protection: today Escape closes the modal and loses edits. Fixed by the dirty-state guard.
7. There is no way to duplicate an item. Added.
8. There is no quick way to see the item as customers do. "View on store" added.

## Tasks

### Task 1: Server — validator, single-item GET, POST fix
**Files:** create `lib/menu-item-input.ts` and `lib/menu-item-input.test.ts`; modify `app/api/admin/menu-items/route.ts` and `app/api/admin/menu-items/[id]/route.ts`. Route tests go in `app/api/admin/menu-items/route.test.ts` (create it) and `app/api/admin/menu-items/[id]/route.test.ts` (create it). Follow the mock pattern in `app/api/admin/store-settings/route.test.ts`.

`validateMenuItemInput(body: unknown, { partial }: { partial: boolean }): { ok: true; value: Record<string, unknown> } | { ok: false; error: string }`
- Only allow-listed keys pass through: the current PATCHABLE set plus `compare_at_price`, which is already in PATCHABLE. Unknown keys are dropped, which keeps today's PATCH behaviour.
- `name`: trimmed non-empty string, at most 80 characters. Required when not `partial`.
- `price`: finite number, 0 < price ≤ 1000. Required when not `partial`.
- `compare_at_price`: null, or a finite number > 0.
- `category`: non-empty string. Required when not `partial`.
- `description`: string or null.
- `image_url`: string or null.
- `is_available`: boolean.
- Each modifier list (`spicy_levels`, `add_ons`, `drinks_regular`, `drinks_large`, `dips`, `sides`, `fries_regular`, `fries_large`, `other_extras`, `extra_ingredients`, `extras`): must be an array of `{ name: non-empty string, price: finite number ≥ 0, description?: string, badge?: string }`, at most 50 entries.
- `ingredients`, `removals`, `additions`, `dietary_flags`, `allergens`, `sold_out_extras`: arrays of strings.
- `modifier_select_modes`: an object whose values are each `single`, `multi` or `pick`.
- Error messages are specific, for example "Price must be more than £0.00" or "Drinks (Regular): every option needs a name".

POST uses `partial: false`, passes `compare_at_price` through, keeps its defaults, and drops the `console.log`. PATCH uses `partial: true`. Add GET `[id]`. TDD throughout.

### Task 2: Editor pages
**Files:**
- Create `components/admin/menu-item-editor/` and move out of `app/admin/page.tsx` the form helpers the editor needs: `ExtraNameInput`, `FormSection`, `Disclosure`, `SelectStyle`, `DuplicateWarning`, `TagSection`, `PricedSection`, `PriceInput`, `DetailInputs`, `draftToExtra`, the `PRICED_CATEGORIES` / `DEFAULT_SELECT_MODES` / input class constants, and the `MenuItem`/`Extra` types. Keep behaviour identical. Split them into sensible files.
- Create `components/admin/menu-item-editor/MenuItemEditor.tsx`, the page body described above.
- Create `app/admin/menu/new/page.tsx` and `app/admin/menu/[id]/page.tsx`.
- Modify `app/admin/page.tsx`:
  - delete `ItemModal`
  - "Add item" links to `/admin/menu/new`, and Edit (both views) links to `/admin/menu/<id>`
  - show the `?saved=` toast
- Everything the list page still uses stays there or is imported back.

Keep the legacy-additions fold (additions become £0.00 Extra Ingredients with the 'pick' mode) and `additions: []` on save.

**Verification:** `tsc`, `vitest`, and eslint with no new findings on the touched files; the admin page already has 7 pre-existing lint errors, so count before and after. Then a browser check. `/admin` needs a staff sign-in: if you can't sign in, say so, and verify the pages render their signed-out or forbidden state without crashing, plus a code review.
