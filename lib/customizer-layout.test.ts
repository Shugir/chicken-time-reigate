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
      { tag: '02', label: 'Drink: Large Cola', amount: 0.8 },
      { tag: '05', label: 'Dip: Chipotle BBQ', amount: 0.75 },
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
