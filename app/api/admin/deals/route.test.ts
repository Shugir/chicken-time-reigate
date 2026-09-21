import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/get-user-permissions', () => ({
  getUserPermissions: vi.fn(),
  hasPermission: vi.fn(),
}))

import { validateConfig } from './route'

const bundle = (extra: Record<string, unknown> = {}) => ({
  groups: [{ label: 'Main', min_qty: 1, max_qty: 1, item_ids: ['a'] }],
  price: 9.99,
  ...extra,
})

describe('validateConfig bundle upgrades', () => {
  it('passes without upgrades', () => {
    expect(validateConfig('bundle', bundle())).toBeNull()
  })

  it('passes with valid upgrades', () => {
    expect(validateConfig('bundle', bundle({ upgrades: { label: 'Make it a meal', item_ids: ['x', 'y'] } }))).toBeNull()
  })

  it('passes with upgrades and no label', () => {
    expect(validateConfig('bundle', bundle({ upgrades: { item_ids: [] } }))).toBeNull()
  })

  it('rejects upgrades that is not an object', () => {
    expect(validateConfig('bundle', bundle({ upgrades: 'x' }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: ['x'] }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: null }))).toEqual(expect.any(String))
  })

  it('rejects item_ids that is not an array', () => {
    expect(validateConfig('bundle', bundle({ upgrades: { item_ids: 'x' } }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: {} }))).toEqual(expect.any(String))
  })

  it('rejects non-string ids', () => {
    expect(validateConfig('bundle', bundle({ upgrades: { item_ids: ['x', 5] } }))).toEqual(expect.any(String))
  })

  it('rejects more than 30 ids', () => {
    const ids = Array.from({ length: 31 }, (_, i) => `id${i}`)
    expect(validateConfig('bundle', bundle({ upgrades: { item_ids: ids } }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: { item_ids: ids.slice(0, 30) } }))).toBeNull()
  })

  it('rejects a label over 60 chars or not a string', () => {
    expect(validateConfig('bundle', bundle({ upgrades: { label: 'x'.repeat(61), item_ids: ['a'] } }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: { label: 5, item_ids: ['a'] } }))).toEqual(expect.any(String))
    expect(validateConfig('bundle', bundle({ upgrades: { label: 'x'.repeat(60), item_ids: ['a'] } }))).toBeNull()
  })
})
