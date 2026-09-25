import { describe, it, expect } from 'vitest'
import { extraQty, extrasTotal, unitPrice, formatExtra, toModifierConfig, spicyPrice } from './order-modifiers'

describe('extra quantity and pricing', () => {
  it('treats a missing or invalid qty as 1', () => {
    expect(extraQty({})).toBe(1)
    expect(extraQty({ qty: 0 })).toBe(1)
    expect(extraQty({ qty: 3 })).toBe(3)
  })

  it('multiplies price by qty and rounds to 2dp', () => {
    expect(extrasTotal([{ price: 1.1, qty: 3 }, { price: 0.5 }])).toBe(3.8)
    expect(extrasTotal([])).toBe(0)
  })

  it('adds extras to the base for the unit price', () => {
    expect(unitPrice(5, [{ price: 1.5, qty: 2 }, { price: 0 }])).toBe(8)
  })

  it('prices a chosen spicy level, 0 when none is chosen or it is not offered', () => {
    const levels = [{ name: 'Mild', price: 0 }, { name: 'Reaper', price: 0.5 }]
    expect(spicyPrice(levels, 'Reaper')).toBe(0.5)
    expect(spicyPrice(levels, 'Mild')).toBe(0)
    expect(spicyPrice(levels, 'Gone')).toBe(0)
    expect(spicyPrice(levels, null)).toBe(0)
    expect(spicyPrice(levels, undefined)).toBe(0)
    expect(spicyPrice(undefined, 'Reaper')).toBe(0)
  })

  it('formats quantity only when above 1', () => {
    expect(formatExtra({ name: 'Coke', qty: 2 })).toBe('Coke ×2')
    expect(formatExtra({ name: 'Coke', qty: 1 })).toBe('Coke')
    expect(formatExtra({ name: 'Coke' })).toBe('Coke')
  })
})

describe('toModifierConfig', () => {
  it('orders categories: extra ingredients, drinks, sides, fries, dips, add-ons, other extras', () => {
    const cfg = toModifierConfig({
      extra_ingredients: [{ name: 'Extra Cheese', price: 0.5 }],
      drinks_regular: [{ name: 'Coke', price: 1.5 }],
      drinks_large: [{ name: 'Large Coke', price: 2 }],
      sides: [{ name: 'Coleslaw', price: 1 }],
      fries_regular: [{ name: 'Peri Fries', price: 2 }],
      fries_large: [{ name: 'Large Peri Fries', price: 3 }],
      dips: [{ name: 'Mayo', price: 0 }],
      add_ons: [{ name: 'Bacon', price: 1 }],
      other_extras: [{ name: 'Cutlery Pack', price: 0 }],
    })
    expect(cfg.categories.map((c) => c.key)).toEqual([
      'extra_ingredients', 'drinks_regular', 'drinks_large', 'sides',
      'fries_regular', 'fries_large', 'dips', 'add_ons', 'other_extras',
    ])
  })

  it('defaults extra_ingredients to multi select mode', () => {
    const cfg = toModifierConfig({ extra_ingredients: [{ name: 'Extra Cheese', price: 0.5 }] })
    expect(cfg.categories.find((c) => c.key === 'extra_ingredients')!.mode).toBe('multi')
  })

  it('reads the new columns and merges select modes over the defaults', () => {
    const cfg = toModifierConfig({
      spicy_levels: [{ name: 'Mild', price: 0 }, { name: 'Hot', price: 0 }],
      ingredients: ['Lettuce'],
      dips: [{ name: 'Mayo', price: 0 }],
      drinks_regular: [{ name: 'Coke', price: 1.5 }],
      modifier_select_modes: { dips: 'multi' },
    })
    expect(cfg.spicyLevels).toEqual([{ name: 'Mild', price: 0 }, { name: 'Hot', price: 0 }])
    expect(cfg.spicyMode).toBe('single')
    expect(cfg.ingredients).toEqual(['Lettuce'])
    expect(cfg.categories.map((c) => c.key)).toEqual(['drinks_regular', 'dips'])
    expect(cfg.categories.find((c) => c.key === 'dips')!.mode).toBe('multi')
    expect(cfg.categories.find((c) => c.key === 'drinks_regular')!.mode).toBe('multi')
  })

  it('passes spicy levels through as priced options with description and badge', () => {
    const reaper = { name: 'Reaper Inferno', price: 0.5, description: 'Not for the faint-hearted.', badge: '2M SHU' }
    const cfg = toModifierConfig({ spicy_levels: [{ name: 'Mild', price: 0 }, reaper] })
    expect(cfg.spicyLevels).toEqual([{ name: 'Mild', price: 0 }, reaper])
  })

  it('passes description and badge through on any priced category', () => {
    const glaze = { name: 'Garlic Butter', price: 0.6, description: 'Garlic herb butter glaze, zero burn.', badge: 'Chef Choice' }
    const cfg = toModifierConfig({ dips: [glaze] })
    expect(cfg.categories[0].options).toEqual([glaze])
  })

  it('omits empty categories', () => {
    expect(toModifierConfig({ sides: [] }).categories).toEqual([])
  })

  it('falls back to legacy removals and extras when the new columns are empty', () => {
    const cfg = toModifierConfig({
      ingredients: [],
      removals: ['Pickles'],
      add_ons: [],
      extras: [{ name: 'Bacon', price: 1 }],
    })
    expect(cfg.ingredients).toEqual(['Pickles'])
    expect(cfg.categories).toEqual([
      { key: 'add_ons', label: 'Add-ons', options: [{ name: 'Bacon', price: 1 }], mode: 'multi' },
    ])
  })

  it('prefers the new columns over legacy ones when both are set', () => {
    const cfg = toModifierConfig({
      ingredients: ['Lettuce'], removals: ['Pickles'],
      add_ons: [{ name: 'Cheese', price: 0.5 }], extras: [{ name: 'Bacon', price: 1 }],
    })
    expect(cfg.ingredients).toEqual(['Lettuce'])
    expect(cfg.categories[0].options).toEqual([{ name: 'Cheese', price: 0.5 }])
  })

  it('returns an empty config for a bare row', () => {
    expect(toModifierConfig({})).toEqual({
      spicyLevels: [], spicyMode: 'single', ingredients: [], additions: [], categories: [],
    })
  })
})
