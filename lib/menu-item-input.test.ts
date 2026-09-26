import { describe, it, expect } from 'vitest'
import { validateMenuItemInput } from './menu-item-input'

// Shape the admin item editor sends on save
const full = () => ({
  name: '  Zinger Burger ',
  description: null,
  price: 6.49,
  compare_at_price: null,
  image_url: null,
  category: 'burgers',
  is_available: true,
  sold_out_extras: [],
  additions: [],
  ingredients: ['Lettuce', 'Mayo'],
  spicy_levels: [{ name: 'Mild', price: 0 }, { name: 'Reaper', price: 0.5, badge: '1M SHU' }],
  extra_ingredients: [{ name: 'Cheese', price: 0 }, { name: 'Bacon', price: 1, description: 'Smoked' }],
  drinks_regular: [], drinks_large: [], sides: [], fries_regular: [], fries_large: [],
  dips: [{ name: 'BBQ', price: 0.75 }], add_ons: [], other_extras: [],
  modifier_select_modes: { spicy_levels: 'single', extra_ingredients: 'pick', dips: 'multi' },
  dietary_flags: ['halal'],
  allergens: ['gluten'],
})

const err = (body: unknown, partial = false) => {
  const r = validateMenuItemInput(body, { partial })
  return r.ok ? null : r.error
}

describe('validateMenuItemInput (create)', () => {
  it('accepts everything the editor sends and trims the name', () => {
    const r = validateMenuItemInput(full(), { partial: false })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('Zinger Burger')
      expect(r.value.spicy_levels).toEqual(full().spicy_levels)
      expect(r.value.compare_at_price).toBeNull()
    }
  })

  it('drops unknown keys', () => {
    const r = validateMenuItemInput({ ...full(), id: 'x', created_at: 'y' }, { partial: false })
    expect(r.ok && 'id' in r.value).toBe(false)
    expect(r.ok && 'created_at' in r.value).toBe(false)
  })

  it.each([
    [{ name: undefined }, 'Name is required'],
    [{ name: '   ' }, 'Name is required'],
    [{ name: 'x'.repeat(81) }, 'Name must be 80 characters or fewer'],
    [{ price: undefined }, 'Price is required'],
    [{ price: 0 }, 'Price must be more than £0.00'],
    [{ price: '6.49' }, 'Price must be a number'],
    [{ price: Number.NaN }, 'Price must be a number'],
    [{ price: 1000.01 }, 'Price must be £1000.00 or less'],
    [{ category: undefined }, 'Category is required'],
    [{ category: '' }, 'Category is required'],
  ])('rejects %j', (patch, message) => {
    expect(err({ ...full(), ...patch })).toBe(message)
  })

  it('accepts a price of exactly 1000', () => {
    expect(err({ ...full(), price: 1000 })).toBeNull()
  })
})

describe('validateMenuItemInput (fields)', () => {
  it.each([
    [{ compare_at_price: 0 }, 'Compare-at price must be more than £0.00'],
    [{ compare_at_price: '8' }, 'Compare-at price must be a number'],
    [{ description: 5 }, 'Description must be text'],
    [{ image_url: {} }, 'Image URL must be text'],
    [{ is_available: 'yes' }, 'Availability must be true or false'],
    [{ drinks_regular: [{ name: '', price: 1 }] }, 'Drinks (Regular): every option needs a name'],
    [{ drinks_regular: [{ price: 1 }] }, 'Drinks (Regular): every option needs a name'],
    [{ dips: [{ name: 'BBQ', price: -1 }] }, 'Dips: every option needs a price of £0.00 or more'],
    [{ dips: [{ name: 'BBQ' }] }, 'Dips: every option needs a price of £0.00 or more'],
    [{ spicy_levels: [{ name: 'Hot', price: '0' }] }, 'Spicy Level: every option needs a price of £0.00 or more'],
    [{ sides: [{ name: 'Slaw', price: 1, badge: 3 }] }, 'Sides: option details must be text'],
    [{ sides: 'Slaw' }, 'Sides must be a list'],
    [{ add_ons: Array.from({ length: 51 }, (_, i) => ({ name: `A${i}`, price: 0 })) }, 'Add-ons: at most 50 options'],
    [{ extras: [null] }, 'Extras: every option needs a name'],
    [{ ingredients: ['Lettuce', 3] }, 'Ingredients must be a list of text'],
    [{ allergens: 'gluten' }, 'Allergens must be a list of text'],
    [{ modifier_select_modes: { dips: 'many' } }, 'Unknown choice style: many'],
    [{ modifier_select_modes: ['single'] }, 'Choice styles must be an object'],
    [{ modifier_select_modes: null }, 'Choice styles must be an object'],
  ])('rejects %j', (patch, message) => {
    expect(err({ ...full(), ...patch })).toBe(message)
  })

  it('accepts a positive compare-at price', () => {
    expect(err({ ...full(), compare_at_price: 7.99 })).toBeNull()
  })

  it.each([null, [], 'x', 3])('rejects a non-object body %j', (body) => {
    expect(err(body)).toBe('Invalid body')
  })
})

describe('validateMenuItemInput (partial)', () => {
  it('accepts the list page availability toggle', () => {
    expect(validateMenuItemInput({ is_available: false }, { partial: true })).toEqual({ ok: true, value: { is_available: false } })
  })

  it('accepts the list page inline price edit', () => {
    expect(validateMenuItemInput({ price: 5.5 }, { partial: true })).toEqual({ ok: true, value: { price: 5.5 } })
  })

  it('does not require name, price or category', () => {
    expect(err({ description: 'Hot' }, true)).toBeNull()
  })

  it('still validates the fields it is given', () => {
    expect(err({ price: 0 }, true)).toBe('Price must be more than £0.00')
    expect(err({ name: '' }, true)).toBe('Name is required')
  })

  it('accepts the full editor payload', () => {
    expect(err(full(), true)).toBeNull()
  })
})
