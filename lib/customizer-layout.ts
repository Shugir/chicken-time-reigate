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
