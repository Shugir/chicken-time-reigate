import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safe-next'

describe('safeNextPath', () => {
  it('accepts a same-origin relative path', () => {
    expect(safeNextPath('/order/customize/abc')).toBe('/order/customize/abc')
    expect(safeNextPath('/account?tab=orders')).toBe('/account?tab=orders')
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['absolute URL', 'https://evil.com'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['tab-smuggled protocol-relative', '/\t/evil.com'],
    ['bare path without slash', 'order'],
    ['empty', ''],
  ])('rejects %s', (_, value) => {
    expect(safeNextPath(value)).toBeNull()
  })

  it('rejects null and undefined', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })
})
