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

  it("forces qty 1 in a 'pick' category but keeps several different options", () => {
    const pickConfig = toModifierConfig({
      sides: [{ name: 'Slaw', price: 1 }, { name: 'Beans', price: 1.2 }],
      modifier_select_modes: { sides: 'pick' },
    })
    const r = applyPreset(pickConfig, [], {
      selection: {
        spicy: null, removals: [], additions: [],
        extras: [
          { name: 'Slaw', category: 'sides', qty: 3 },
          { name: 'Beans', category: 'sides', qty: 2 },
          { name: 'Slaw', category: 'sides', qty: 1 },
        ],
      },
      notes: null, qty: 1,
    })
    expect(r.selection.extras).toEqual([
      { name: 'Slaw', price: 1, qty: 1, category: 'sides' },
      { name: 'Beans', price: 1.2, qty: 1, category: 'sides' },
    ])
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
