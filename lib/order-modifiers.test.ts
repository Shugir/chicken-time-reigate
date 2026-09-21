import { describe, it, expect } from 'vitest'
import { extraQty, extrasTotal, unitPrice, formatExtra, toModifierConfig } from './order-modifiers'

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

  it('formats quantity only when above 1', () => {
    expect(formatExtra({ name: 'Coke', qty: 2 })).toBe('Coke ×2')
    expect(formatExtra({ name: 'Coke', qty: 1 })).toBe('Coke')
    expect(formatExtra({ name: 'Coke' })).toBe('Coke')
  })
})

describe('toModifierConfig', () => {
  it('reads the new columns and merges select modes over the defaults', () => {
    const cfg = toModifierConfig({
      spicy_levels: ['Mild', 'Hot'],
      ingredients: ['Lettuce'],
      dips: [{ name: 'Mayo', price: 0 }],
      drinks_regular: [{ name: 'Coke', price: 1.5 }],
      modifier_select_modes: { dips: 'multi' },
    })
    expect(cfg.spicyLevels).toEqual(['Mild', 'Hot'])
    expect(cfg.spicyMode).toBe('single')
    expect(cfg.ingredients).toEqual(['Lettuce'])
    expect(cfg.categories.map((c) => c.key)).toEqual(['drinks_regular', 'dips'])
    expect(cfg.categories.find((c) => c.key === 'dips')!.mode).toBe('multi')
    expect(cfg.categories.find((c) => c.key === 'drinks_regular')!.mode).toBe('multi')
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
