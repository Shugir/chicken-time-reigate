# Customizer: Match the Stitch Structure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the full-page customizer (`app/order/customize/[itemId]/page.tsx`, shipped in sub-project B) so its structure matches the user's Stitch screen "The Firestorm Crispy Chicken Meal - Complete Customizer" (Stitch project `10953315747124414831`, screen `66b516e3dda749f4a5cc872696f79e9a`). The target is the same groups, numbering, sub-sections, option-card behaviour, instructions box and summary receipt, in the site's existing light theme.

**Architecture:** A new pure module `lib/customizer-layout.ts` turns a `ModifierConfig` into the ordered, numbered groups and sections, and turns a selection into the tagged receipt lines. It is unit-tested. A new client component `components/Menu/GroupedCustomizer.tsx` renders the groups as option-card grids. A new `components/Menu/SelectionReceipt.tsx` renders group 09. The page wires them together. `ModifierForm` / `ModifierSection` stay as they are, because the deals popup (`DealSlotPicker`) uses them and is out of scope.

**Tech Stack:** Next.js 16.2.7 App Router client components, React 19.2, Tailwind 4, Vitest 4 (node env, no jsdom), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-26-customizer-fullpage-design.md` (sub-project B) plus the target structure below, taken from the Stitch screen. A local copy of that screen's HTML and screenshot is in `.superpowers/stitch/` (git-ignored). The user's brief, verbatim in intent:
- 01 Meal Customize: 1.1 Spicy Level, 1.2 Ingredients (toggle to remove), 1.3 Extra Ingredients
- 02 Drinks: 2.1 Regular Drinks, 2.2 Large Drinks
- 03 Sides
- 04 Fries: 4.1 Regular Fries, 4.2 Large Fries
- 05 Dips
- 06 Add-ons
- 07 Other Extras
- 08 Special Instructions: textarea with character count and quick-add chips (Fries Well Done, Extra Napkins, Allergy Alert, Sauce on Side)
- 09 Your Selection: sticky live receipt with every choice, itemized math, and the primary "ADD CUSTOM MEAL TO BAG" CTA

## Global Constraints

- **Theme:** light, existing tokens only (`brand-red`, `brand-yellow`, `brand-dark`, zinc neutrals). This was approved for sub-project B. Take structure from Stitch, not its dark colours or fonts.
- **Out of scope:** the deals popup (`components/Deals/DealSlotPicker.tsx`, `ModifierForm`, `ModifierSection`) must render exactly as today.
- **Left for later sub-projects:** the free-delivery progress bar (C), the "UK VAT Included" line (D) and the Save Preset button (E). Do not render them.
- **Prices:** always go through `lineUnitPrice` (`lib/menu-items.ts`). The checkout API rejects any mismatch.
- **Touch targets:** at least 44px (`min-h-[44px]` / `w-11 h-11`).
- **Mobile:** no horizontal scroll at 360px.
- **Visibility:** empty groups and sections are hidden. Group numbers run gap-free across the visible groups ("01", "02", …). Sub-section numbers run gap-free inside a group ("1.1", "1.2", …). Special Instructions is the next group number after the last option group, and Your Selection the one after that. On a fully loaded item this yields exactly 01–09.
- **Notes:** `maxLength` is 250 and the counter shows `N / 250`.
- **Staging:** stage only the files each task lists. Never `git add -A`. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **AGENTS.md:** this Next.js version differs from training data. Check `node_modules/next/dist/docs/` before using any Next API you are unsure of.

## Rulings made for this plan (the user asked for autonomous execution)

1. **Free additions** (the `additions` list, always £0) have no Stitch counterpart. They join group 07 Other Extras as free checkbox cards, after the `other_extras` options. Their receipt tag is `[07]`.
2. **"1st dip included free"** is a pricing rule, not structure, and it would change server pricing (`lib/checkout-pricing.ts`). It is not built. Admins can reproduce it with data: set dips to multi-select, price one dip at £0, and give it the badge "1st Dip Included". The group subtitle stays generic. This is flagged to the user.
3. **Group layout.** Groups 01, 02 and 04 show sub-section headers ("1.1 …"). Groups 03, 05, 06 and 07 are flat: no sub-header, and their receipt tags use the bare group number ("[03]").
4. **"N Selected" chip.** Each option group shows a chip with the number of units chosen in that group, and only when that number is above 0. Removals count toward group 01's number.
5. **Stitch sample content is not seeded.** The menu options in the mockup (Reaper Inferno, Halloumi Fries, …) are sample data and are not written to the live database. Admins enter real options in the existing admin form.

## Review Focus

1. **Numbering with missing sections.** For an item with only spicy levels and dips, groups must read 01 Item Customize (1.1 only), 02 Dips, 03 Special Instructions, 04 Your Selection. No gaps, and no "1.2" without "1.1". Pinned by `customizerLayout` tests in Task 1.
2. **Receipt math equals the charged price.** Base + customizations must equal `lineUnitPrice`, and × qty must equal the CTA total. This matters for a paid spicy level plus multi-qty extras. Pinned by `receiptTotals` tests in Task 1.
3. **Quick-add chips and the 250 cap.** Toggling a chip when the note is near 250 characters must not exceed 250, and toggling it off must remove only that phrase. Pinned by `toggleQuickNote` tests in Task 1.
4. **Single-mode categories** (dips, fries): tapping the chosen card again clears it. Multi-mode categories: "+ Add" becomes a − n + stepper, and n = 0 returns it to "+ Add". The behaviour must match the existing `ModifierForm` so saved selections and checkout keys stay identical. Checked in the Task 2 review against `ModifierForm.tsx`.
5. **Sold-out options** show "Sold out" and cannot be chosen in every card type. Checked in the Task 2 review and the Task 4 browser check.

---

### Task 1: `lib/customizer-layout.ts` (pure layout, receipt lines, totals, quick notes)

**Files:**
- Create: `lib/customizer-layout.ts`
- Test: `lib/customizer-layout.test.ts`

**Interfaces:**
- Consumes: `ModifierConfig`, `ModifierCategory`, `PricedCategoryKey`, `spicyPrice`, `extraQty`, `formatExtra` from `lib/order-modifiers.ts`, and `ModifierSelection` from `components/Menu/ModifierForm.tsx` (type-only import).
- Produces:

```ts
export type GroupKey = 'item' | 'drinks' | 'sides' | 'fries' | 'dips' | 'add_ons' | 'other'
export type SectionKind = 'spicy' | 'ingredients' | 'category' | 'additions'
export interface LayoutSection {
  key: string                 // 'spicy' | 'ingredients' | category key | 'additions'
  kind: SectionKind
  number: string | null       // '1.1' in grouped groups, null in flat groups
  title: string               // e.g. 'Spicy Level (Choose 1)'
  hint: string                // right-side hint, e.g. 'Toggle to remove'
  category?: ModifierCategory // for kind 'category'
}
export interface LayoutGroup {
  key: GroupKey
  number: string              // '01'
  title: string
  subtitle: string
  flat: boolean
  sections: LayoutSection[]
}
export function customizerLayout(config: ModifierConfig): LayoutGroup[]
export function groupSelectedCount(group: LayoutGroup, selection: ModifierSelection): number
export interface ReceiptLine { tag: string; label: string; amount: number | 'included' | 'free' }
export function receiptLines(layout: LayoutGroup[], config: ModifierConfig, selection: ModifierSelection, notes: string): ReceiptLine[]
export function receiptTotals(base: number, unit: number, qty: number): { base: number; customizations: number; subtotal: number }
export const NOTES_MAX = 250
export const QUICK_NOTES = ['Fries Well Done', 'Extra Napkins', 'Allergy Alert', 'Sauce On Side'] as const
export function toggleQuickNote(notes: string, phrase: string): string
export function hasQuickNote(notes: string, phrase: string): boolean
```

- [ ] **Step 1: Write the failing tests.** Create `lib/customizer-layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toModifierConfig } from './order-modifiers'
import {
  customizerLayout, groupSelectedCount, receiptLines, receiptTotals,
  toggleQuickNote, hasQuickNote, NOTES_MAX,
} from './customizer-layout'

const full = toModifierConfig({
  spicy_levels: [{ name: 'Mild', price: 0 }, { name: 'Reaper Inferno', price: 0.5 }],
  ingredients: ['Crispy Filet', 'Pickles'],
  extra_ingredients: [{ name: 'Bacon', price: 1.5 }],
  drinks_regular: [{ name: 'Coca-Cola', price: 0 }],
  drinks_large: [{ name: 'Large Cola', price: 0.8 }],
  sides: [{ name: 'Halloumi Fries', price: 3.2 }],
  fries_regular: [{ name: 'Rustic', price: 0 }],
  fries_large: [{ name: 'Cajun Curly', price: 1.2 }],
  dips: [{ name: 'Chipotle BBQ', price: 0.75 }],
  add_ons: [{ name: 'Hot Honey', price: 2.5 }],
  other_extras: [{ name: 'Cut In Half', price: 0 }],
  additions: ['Napkins'],
})

const empty = { spicy: null, removals: [], additions: [], extras: [] }

describe('customizerLayout', () => {
  it('a fully loaded item yields groups 01-07 in Stitch order with sub-numbers', () => {
    const l = customizerLayout(full)
    expect(l.map((g) => `${g.number} ${g.key}`)).toEqual([
      '01 item', '02 drinks', '03 sides', '04 fries', '05 dips', '06 add_ons', '07 other',
    ])
    expect(l[0].sections.map((s) => s.number)).toEqual(['1.1', '1.2', '1.3'])
    expect(l[1].sections.map((s) => s.number)).toEqual(['2.1', '2.2'])
    expect(l[3].sections.map((s) => s.number)).toEqual(['4.1', '4.2'])
    expect(l[2].flat).toBe(true)
    expect(l[2].sections[0].number).toBeNull()
    expect(l[6].sections.map((s) => s.key)).toEqual(['other_extras', 'additions'])
  })

  it('renumbers gap-free when groups and sections are missing', () => {
    const c = toModifierConfig({ spicy_levels: [{ name: 'Hot', price: 0 }], dips: [{ name: 'BBQ', price: 0.75 }] })
    const l = customizerLayout(c)
    expect(l.map((g) => `${g.number} ${g.key}`)).toEqual(['01 item', '02 dips'])
    expect(l[0].sections.map((s) => s.number)).toEqual(['1.1'])
  })

  it('sub-numbers restart per group and skip missing sections', () => {
    const c = toModifierConfig({ ingredients: ['Pickles'], fries_large: [{ name: 'Curly', price: 1.2 }] })
    const l = customizerLayout(c)
    expect(l[0].sections.map((s) => `${s.number} ${s.key}`)).toEqual(['1.1 ingredients'])
    expect(l[1].sections.map((s) => `${s.number} ${s.key}`)).toEqual(['2.1 fries_large'])
  })

  it('an item with nothing to choose has no groups', () => {
    expect(customizerLayout(toModifierConfig({}))).toEqual([])
  })
})

describe('groupSelectedCount', () => {
  it('counts spicy, removals and extra units in group 01, units per category elsewhere', () => {
    const l = customizerLayout(full)
    const sel = {
      spicy: 'Reaper Inferno', removals: ['Pickles'], additions: ['Napkins'],
      extras: [
        { name: 'Bacon', price: 1.5, qty: 2, category: 'extra_ingredients' },
        { name: 'Large Cola', price: 0.8, qty: 1, category: 'drinks_large' },
      ],
    }
    expect(groupSelectedCount(l[0], sel)).toBe(4)
    expect(groupSelectedCount(l[1], sel)).toBe(1)
    expect(groupSelectedCount(l[2], sel)).toBe(0)
    expect(groupSelectedCount(l[6], sel)).toBe(1)
  })
})

describe('receiptLines', () => {
  it('tags every choice with its section number and prices it', () => {
    const l = customizerLayout(full)
    const sel = {
      spicy: 'Reaper Inferno', removals: ['Pickles'], additions: ['Napkins'],
      extras: [
        { name: 'Bacon', price: 1.5, qty: 2, category: 'extra_ingredients' },
        { name: 'Large Cola', price: 0.8, qty: 1, category: 'drinks_large' },
        { name: 'Chipotle BBQ', price: 0.75, qty: 1, category: 'dips' },
      ],
    }
    expect(receiptLines(l, full, sel, '  Fries well done  ')).toEqual([
      { tag: '01.1', label: 'Heat: Reaper Inferno', amount: 0.5 },
      { tag: '01.2', label: 'Crispy Filet', amount: 'included' },
      { tag: '01.2', label: 'No Pickles', amount: 'free' },
      { tag: '01.3', label: 'Bacon ×2', amount: 3 },
      { tag: '02.2', label: 'Large Cola', amount: 0.8 },
      { tag: '05', label: 'Chipotle BBQ', amount: 0.75 },
      { tag: '07', label: 'Napkins', amount: 'free' },
      { tag: '08', label: 'Note: "Fries well done"', amount: 'free' },
    ])
  })

  it('lists nothing but included ingredients for an untouched item, and no note line when empty', () => {
    const l = customizerLayout(full)
    expect(receiptLines(l, full, empty, '')).toEqual([
      { tag: '01.2', label: 'Crispy Filet, Pickles', amount: 'included' },
    ])
  })

  it('uses the special-instructions number that follows the last option group', () => {
    const c = toModifierConfig({ dips: [{ name: 'BBQ', price: 0.75 }] })
    const l = customizerLayout(c)
    expect(receiptLines(l, c, empty, 'hi')).toEqual([{ tag: '02', label: 'Note: "hi"', amount: 'free' }])
  })
})

describe('receiptTotals', () => {
  it('splits the charged unit price into base and customizations, times qty', () => {
    expect(receiptTotals(7.99, 12.99, 1)).toEqual({ base: 7.99, customizations: 5, subtotal: 12.99 })
    expect(receiptTotals(7.99, 10.49, 2)).toEqual({ base: 7.99, customizations: 2.5, subtotal: 20.98 })
  })
})

describe('quick notes', () => {
  it('appends a phrase with a separator and removes only that phrase', () => {
    let n = toggleQuickNote('', 'Extra Napkins')
    expect(n).toBe('Extra Napkins')
    n = toggleQuickNote(n, 'Sauce On Side')
    expect(n).toBe('Extra Napkins. Sauce On Side')
    expect(hasQuickNote(n, 'Sauce On Side')).toBe(true)
    n = toggleQuickNote(n, 'Extra Napkins')
    expect(n).toBe('Sauce On Side')
    expect(hasQuickNote(n, 'Extra Napkins')).toBe(false)
  })

  it('keeps free text the customer typed', () => {
    expect(toggleQuickNote('no onions', 'Allergy Alert')).toBe('no onions. Allergy Alert')
  })

  it('never goes over the character limit', () => {
    const long = 'x'.repeat(NOTES_MAX - 3)
    expect(toggleQuickNote(long, 'Extra Napkins')).toBe(long)
  })
})
```

The ingredients rule in the receipt: when nothing is removed, one line lists all included ingredients joined with ", ". When some are removed, one line lists the kept ones ("included") and then one "No X" line per removal ("free"). If every ingredient is removed, there is no "included" line.

- [ ] **Step 2: Run to verify the tests fail**

Run: `npx vitest run lib/customizer-layout.test.ts`
Expected: FAIL, cannot resolve `./customizer-layout`.

- [ ] **Step 3: Implement `lib/customizer-layout.ts`**

```ts
// Turns an item's modifier config into the numbered groups of the full-page customizer
// (structure from the Stitch "Complete Customizer" screen) and a selection into its receipt.

import { extraQty, formatExtra, spicyPrice, type ModifierCategory, type ModifierConfig, type PricedCategoryKey } from './order-modifiers'
import type { ModifierSelection } from '@/components/Menu/ModifierForm'

export type GroupKey = 'item' | 'drinks' | 'sides' | 'fries' | 'dips' | 'add_ons' | 'other'
export type SectionKind = 'spicy' | 'ingredients' | 'category' | 'additions'

export interface LayoutSection {
  key: string
  kind: SectionKind
  number: string | null
  title: string
  hint: string
  category?: ModifierCategory
}

export interface LayoutGroup {
  key: GroupKey
  number: string
  title: string
  subtitle: string
  flat: boolean
  sections: LayoutSection[]
}

type SectionDef = { key: string; kind: SectionKind; title: string; hint: string }
type GroupDef = { key: GroupKey; title: string; subtitle: string; flat: boolean; sections: SectionDef[] }

const cat = (key: PricedCategoryKey, title: string, hint: string): SectionDef => ({ key, kind: 'category', title, hint })

const GROUPS: GroupDef[] = [
  {
    key: 'item', title: 'Item Customize', flat: false,
    subtitle: 'Set your heat, adjust included layers and stack extras.',
    sections: [
      { key: 'spicy', kind: 'spicy', title: 'Spicy Level (Choose 1)', hint: 'Tap again to clear' },
      { key: 'ingredients', kind: 'ingredients', title: 'Ingredients (Included in Base)', hint: 'Toggle to remove' },
      cat('extra_ingredients', 'Extra Ingredients', 'Add as many as you like'),
    ],
  },
  {
    key: 'drinks', title: 'Drinks', flat: false,
    subtitle: 'Pick a regular drink or upgrade to large.',
    sections: [cat('drinks_regular', 'Regular Drinks', 'Standard portion'), cat('drinks_large', 'Large Drinks (Upgrade)', 'Upsize option')],
  },
  { key: 'sides', title: 'Sides', flat: true, subtitle: 'Add something extra on the side.', sections: [cat('sides', 'Sides', '')] },
  {
    key: 'fries', title: 'Fries', flat: false,
    subtitle: 'Choose your portion and seasoning.',
    sections: [cat('fries_regular', 'Regular Fries', 'Standard portion'), cat('fries_large', 'Large Fries (Upgrade)', 'Upsize option')],
  },
  { key: 'dips', title: 'Dips', flat: true, subtitle: 'House sauces for dipping.', sections: [cat('dips', 'Dips', '')] },
  { key: 'add_ons', title: 'Add-ons', flat: true, subtitle: 'Extra supplies and toppers.', sections: [cat('add_ons', 'Add-ons', '')] },
  {
    key: 'other', title: 'Other Extras', flat: true,
    subtitle: 'Packaging tweaks and kitchen preferences.',
    sections: [cat('other_extras', 'Other Extras', ''), { key: 'additions', kind: 'additions', title: 'Free additions', hint: '' }],
  },
]

const pad2 = (n: number) => String(n).padStart(2, '0')

function isPresent(def: SectionDef, config: ModifierConfig): ModifierCategory | true | false {
  if (def.kind === 'spicy') return config.spicyLevels.length > 0
  if (def.kind === 'ingredients') return config.ingredients.length > 0
  if (def.kind === 'additions') return config.additions.length > 0
  return config.categories.find((c) => c.key === def.key) ?? false
}

/** Visible groups in Stitch order, numbered gap-free ("01"…), sub-sections "1.1"… in non-flat groups. */
export function customizerLayout(config: ModifierConfig): LayoutGroup[] {
  const out: LayoutGroup[] = []
  for (const g of GROUPS) {
    const sections: LayoutSection[] = []
    for (const def of g.sections) {
      const present = isPresent(def, config)
      if (!present) continue
      sections.push({ ...def, number: null, category: present === true ? undefined : present })
    }
    if (sections.length === 0) continue
    const groupNo = out.length + 1
    if (!g.flat) sections.forEach((s, i) => { s.number = `${groupNo}.${i + 1}` })
    out.push({ key: g.key, number: pad2(groupNo), title: g.title, subtitle: g.subtitle, flat: g.flat, sections })
  }
  return out
}

/** Units chosen in one group: spicy (1), each removal, extra quantities, free additions. */
export function groupSelectedCount(group: LayoutGroup, selection: ModifierSelection): number {
  let n = 0
  for (const s of group.sections) {
    if (s.kind === 'spicy' && selection.spicy) n += 1
    if (s.kind === 'ingredients') n += selection.removals.length
    if (s.kind === 'additions') n += selection.additions.length
    if (s.kind === 'category') {
      n += selection.extras.filter((e) => e.category === s.key).reduce((sum, e) => sum + extraQty(e), 0)
    }
  }
  return n
}

export interface ReceiptLine { tag: string; label: string; amount: number | 'included' | 'free' }

const tagOf = (group: LayoutGroup, section: LayoutSection) =>
  section.number ? `${group.number}.${section.number.split('.')[1]}` : group.number

const round2 = (n: number) => Math.round(n * 100) / 100

/** Every choice as a tagged receipt line, in page order, followed by the note (tagged with its group number). */
export function receiptLines(layout: LayoutGroup[], config: ModifierConfig, selection: ModifierSelection, notes: string): ReceiptLine[] {
  const lines: ReceiptLine[] = []
  for (const g of layout) {
    for (const s of g.sections) {
      const tag = tagOf(g, s)
      if (s.kind === 'spicy' && selection.spicy) {
        const price = spicyPrice(config.spicyLevels, selection.spicy)
        lines.push({ tag, label: `Heat: ${selection.spicy}`, amount: price > 0 ? price : 'free' })
      }
      if (s.kind === 'ingredients') {
        const kept = config.ingredients.filter((i) => !selection.removals.includes(i))
        if (kept.length > 0) lines.push({ tag, label: kept.join(', '), amount: 'included' })
        for (const r of selection.removals) lines.push({ tag, label: `No ${r}`, amount: 'free' })
      }
      if (s.kind === 'category') {
        for (const e of selection.extras.filter((x) => x.category === s.key)) {
          const total = round2(e.price * extraQty(e))
          lines.push({ tag, label: formatExtra(e), amount: total > 0 ? total : 'free' })
        }
      }
      if (s.kind === 'additions') {
        for (const a of selection.additions) lines.push({ tag, label: a, amount: 'free' })
      }
    }
  }
  const note = notes.trim()
  if (note) lines.push({ tag: pad2(layout.length + 1), label: `Note: "${note}"`, amount: 'free' })
  return lines
}

/** Receipt footer. `unit` must come from lineUnitPrice so the receipt equals what checkout charges. */
export function receiptTotals(base: number, unit: number, qty: number) {
  return { base: round2(base), customizations: round2(unit - base), subtotal: round2(unit * qty) }
}

export const NOTES_MAX = 250
export const QUICK_NOTES = ['Fries Well Done', 'Extra Napkins', 'Allergy Alert', 'Sauce On Side'] as const

const SEP = '. '
const parts = (notes: string) => notes.split(SEP).map((p) => p.trim()).filter(Boolean)

export function hasQuickNote(notes: string, phrase: string): boolean {
  return parts(notes).includes(phrase)
}

/** Adds the phrase as its own sentence, or removes it. Never grows the note past NOTES_MAX. */
export function toggleQuickNote(notes: string, phrase: string): string {
  const p = parts(notes)
  if (p.includes(phrase)) return p.filter((x) => x !== phrase).join(SEP)
  const next = [...p, phrase].join(SEP)
  return next.length > NOTES_MAX ? notes : next
}
```

Check against the tests. `groupSelectedCount(l[0])` = spicy 1 + removals 1 + Bacon qty 2 = 4. The group-01 receipt for the untouched item gives one "included" line. For `'  Fries well done  '` the note trims to `Fries well done`, tagged `'08'` because the layout has 7 groups. If a test and this code disagree, the test is the requirement. Fix the code, and report any test you believe is wrong instead of editing it.

- [ ] **Step 4: Run to verify the tests pass**

Run: `npx vitest run lib/customizer-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite, then commit**

```bash
npx vitest run
git add lib/customizer-layout.ts lib/customizer-layout.test.ts
git commit -m "feat(customizer): Stitch group layout, receipt lines and quick notes"
```

---

### Task 2: `components/Menu/GroupedCustomizer.tsx` (groups 01–08 as option-card grids)

**Files:**
- Create: `components/Menu/GroupedCustomizer.tsx`

**Interfaces:**
- Consumes: Task 1's `customizerLayout`, `groupSelectedCount`, `NOTES_MAX`, `QUICK_NOTES`, `toggleQuickNote`, `hasQuickNote`, `LayoutGroup`, `LayoutSection`. Also `ModifierSelection` (from `ModifierForm.tsx`), `ModifierConfig`, `PricedOption` (from `lib/order-modifiers.ts`), `QtyStepper` and `OptionBadge` (from `ModifierSection.tsx`).
- Produces:

```tsx
export default function GroupedCustomizer(props: {
  layout: LayoutGroup[]
  config: ModifierConfig
  value: ModifierSelection
  onChange: (next: ModifierSelection) => void
  notes: string
  onNotesChange: (next: string) => void
  soldOut?: string[]
}): JSX.Element
```

Requirements. The selection semantics must be identical to `components/Menu/ModifierForm.tsx`: read it first and reuse its exact update rules.

- **Group card.** Each `LayoutGroup` renders as `<section aria-labelledby=…>`, a white card with `rounded-2xl border border-zinc-100`. It has a header row containing:
  - a round number chip `bg-brand-red text-white` showing `group.number` ("01")
  - the title in `font-heading font-bold`
  - the subtitle in `text-sm text-zinc-500`
  - on the right, when `groupSelectedCount > 0`, a chip "`N Selected`" styled `bg-brand-red/10 text-brand-red text-xs font-bold`
  - a gap of `space-y-6` between group cards
- **Sub-section header.** Only when `!group.flat`: a thin bar `bg-zinc-50 rounded-lg px-3 py-2` showing `"{number} {TITLE}"` as uppercase `text-xs font-bold tracking-wide`, with the section `hint` on the right in `text-brand-red`. Flat groups render their options directly under the group header.
- **Option cards.** A grid of `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`; spicy uses `sm:grid-cols-4`. Every card is a `<button type="button">` with `min-h-[44px]`, `aria-pressed`, `rounded-xl border-2`, and shows name, then description, then badge (use `OptionBadge`), then price. Price text is `+£x.xx`, or `£0.00 (Included)` when the price is 0. The selected state is `border-brand-red bg-brand-red/5` with a check circle top-right. The unselected state shows an empty circle.
  - **spicy** (single): choosing the selected level again clears it. Price hint as above.
  - **ingredients**: a toggle card. Included state shows "Included" in green (`text-emerald-600`) with a check; removed state is struck through and shows "Removed" in red. Tapping toggles membership in `removals`.
  - **category, `mode === 'single'`**: radio card with one choice per category; tapping the chosen card clears it. This is `ModifierForm`'s `pickSingle` rule.
  - **category, `mode === 'multi'`**: the card shows a "+ Add" button when qty is 0. Pressing it sets qty to 1. When qty > 0 the card shows `QtyStepper` (min 0, max 20) instead and is styled as selected, and reaching qty 0 removes the entry. This is `ModifierForm`'s `setExtraQty`. Card and stepper must not nest buttons: when a card has a stepper, render it as a `<div>` and keep the stepper's own buttons.
  - **additions** (free, in group 07): checkbox card showing "Free (£0.00)". Tapping toggles membership in `additions`.
  - **Sold out** (`soldOut` includes the name): the card is disabled, `opacity-50`, and shows "Sold out" in place of the price. It applies to category options and additions, exactly as `ModifierForm` does.
- **Special Instructions group.** After the option groups, render one more card numbered `pad2(layout.length + 1)` with the title "Special Instructions" and the subtitle "Dietary requests, preparation tweaks or packaging notes."
  - The header's right side shows a counter `"{notes.length} / 250"`.
  - It contains a `<textarea>` with `maxLength={NOTES_MAX}`, `rows={3}` and `aria-label="Special instructions"`.
  - Below it: the label "Quick add:" followed by one chip per `QUICK_NOTES` entry, each a `<button type="button" aria-pressed>`. The chip reads `+ Phrase` when off and `✓ Phrase` with `bg-brand-red text-white` when on. It calls `onNotesChange(toggleQuickNote(notes, phrase))`, and `hasQuickNote` decides the state. Chips are at least 44px tall on mobile (`min-h-[44px]`).
- **Accessibility.** The number chip is `aria-hidden`. Sections are labelled by their titles, and sub-section headers are `<h3>`.
- **No summary here.** Group 09 is Task 3.

- [ ] **Step 1:** Read `components/Menu/ModifierForm.tsx`, `components/Menu/ModifierSection.tsx` and `components/Menu/QtyStepper.tsx`.
- [ ] **Step 2:** Implement the component as specified.
- [ ] **Step 3:** Run `npx tsc --noEmit` and `npx eslint components/Menu/GroupedCustomizer.tsx`. Both must be clean, with no new findings.
- [ ] **Step 4:** Commit `components/Menu/GroupedCustomizer.tsx` with the message `feat(customizer): grouped option-card customizer (Stitch groups 01-08)`.

---

### Task 3: `components/Menu/SelectionReceipt.tsx` (group 09, Your Selection)

**Files:**
- Create: `components/Menu/SelectionReceipt.tsx`

**Interfaces:**
- Consumes: Task 1's `ReceiptLine`, `receiptTotals`, and `QtyStepper`.
- Produces:

```tsx
export default function SelectionReceipt(props: {
  number: string          // e.g. '09'
  itemName: string
  basePrice: number
  unit: number            // from lineUnitPrice
  qty: number
  onQtyChange: (n: number) => void
  lines: ReceiptLine[]
  onAdd: () => void
  onReset: () => void
  showActions: boolean    // false on mobile, where the sticky bar carries the CTA
}): JSX.Element
```

Requirements:
- **Card and header.** `<aside aria-label="Your selection">`, a white card with `rounded-2xl border border-zinc-100 shadow-sm p-5`. The header has the round number chip (`bg-brand-red text-white`, same as the group chips) with "Your Selection" and the subtitle "Comprehensive meal build". On the right: "LIVE TOTAL" as a small uppercase label above the total in `text-brand-red font-black tabular-nums`, formatted `£{subtotal.toFixed(2)}`.
- **Item row.** `itemName` with `£{base}` on the right.
- **Lines.** One row per `ReceiptLine`: `[{tag}] {label}` on the left, with the tag in `text-brand-red font-bold tabular-nums`. On the right, the amount: numbers render `+£x.xx`, `'included'` renders "Included", and `'free'` renders "Free". Amounts are `tabular-nums`. When `lines` is empty, show "No changes, served as described." in zinc-400.
- **Quantity.** A row labelled "Quantity" with `QtyStepper` (min 1, max 99, label = itemName).
- **Footer math.** Separated by a top border, using `receiptTotals(basePrice, unit, qty)`:
  - "Base Meal" `£base`
  - "Customizations & Extras" `+£customizations`
  - when qty > 1, "× {qty}"
  - "Order Subtotal" `£subtotal`, bold
- **Actions** (only when `showActions`):
  - A primary button, full width, `min-h-[44px]`, `bg-brand-red hover:bg-red-700 text-white font-bold uppercase tracking-wide rounded-2xl`. It reads "Add custom meal to bag" (uppercase via class) with `£{subtotal}` and a `ArrowRight` icon on the right, and calls `onAdd`.
  - A secondary "Reset all" button, text-only zinc, with a `RotateCcw` icon and `min-h-[44px]`, calling `onReset`.
- **Excluded here:** no VAT line, no free-delivery bar, no Save Preset.
- **Sticky.** Not sticky itself; the page makes it sticky.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx tsc --noEmit` and `npx eslint components/Menu/SelectionReceipt.tsx`. Both must be clean.
- [ ] **Step 3:** Commit with the message `feat(customizer): Your Selection receipt panel (Stitch group 09)`.

---

### Task 4: Page assembly, then verify in the browser

**Files:**
- Modify: `app/order/customize/[itemId]/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–3, plus the existing `lineUnitPrice`, `itemConfig`, `queueCartLine` and `adding` ref guard.

Requirements. Keep everything the current page does: the fetch and redirect logic, the loading skeleton, the double-Add guard, `router.replace('/order')`, the storage try/catch, and `goBack`.

- Replace `ModifierForm` + Special instructions + the current `<aside>` summary with:
  - left column (`lg:col-span-8`): the hero, then `<GroupedCustomizer layout config value onChange notes onNotesChange soldOut />`
  - right column (`lg:col-span-4 lg:sticky lg:top-6 self-start`): `<SelectionReceipt number={pad2(layout.length + 2)} … showActions />`, which only shows at `lg` and up (`hidden lg:block`)
  - on mobile, the receipt renders below the groups with `showActions={false}` (`lg:hidden`)
  - the existing mobile sticky bottom bar stays, with its qty stepper and Add button. Its button label becomes `Add to bag £X`.
- `layout = customizerLayout(config)`. Compute it after the `if (!item)` early return; a plain call is fine, and no hook is needed.
- `lines = receiptLines(layout, config, selection, notes)`.
- `onReset` sets the selection back to `EMPTY_SELECTION`, clears notes, and sets qty to 1.
- **Hero.**
  - Keep the image, name, description, allergens and OFFER badge.
  - Add a row of small badges above the name: `item.badge` if present, and each of `item.dietaryFlags` if present, styled `text-[11px] font-bold uppercase`.
  - Add a "Base meal price" chip next to the price: small uppercase zinc label with the price.
  - Remove any now-unused imports: `ModifierForm` is still needed for `EMPTY_SELECTION` / `ModifierSelection`, but `ModifierSection` and `sectionCount` probably are not.
- `sectionCount` stays exported from `lib/order-modifiers.ts`, because `hasNoCustomization` uses it.

Steps:
- [ ] **Step 1:** Implement. Run `npx tsc --noEmit`, `npx vitest run` and `npx eslint "app/order/customize/[itemId]/page.tsx"`. There must be no new findings.
- [ ] **Step 2: Browser check.** The dev server is already running at `http://localhost:3027`; do not start another. Open `/order/customize/fb40e882-d75e-404a-9847-cac53444ac97` (Classic Smash Burger) at 1280px and 375px. Check:
  - groups read 01…N, then Special Instructions N+1 and Your Selection N+2
  - sub-sections read 1.1/1.2 etc. in groups 01/02/04
  - "N Selected" chips update as you choose
  - multi-select "+ Add" becomes a stepper and back
  - choosing the selected single-select card again clears it
  - quick-add chips toggle, and the counter updates
  - choose Hot + 2 drinks, qty 2: the receipt Order Subtotal equals the CTA and equals £20.98, the same as before this plan
  - Reset all clears everything
  - Add goes to /order with the pill showing the same total
  - no horizontal scroll at 375px

  Save screenshots under `.playwright-mcp/` and delete them after the report.
- [ ] **Step 3:** Commit `app/order/customize/[itemId]/page.tsx` with the message `feat(customizer): page uses Stitch-structured groups and receipt`.
