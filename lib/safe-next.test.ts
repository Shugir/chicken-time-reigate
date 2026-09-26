import { describe, it, expect } from 'vitest'
import { safeNextPath, withNext } from './safe-next'

describe('withNext', () => {
  it('carries a safe next param over to another path', () => {
    expect(withNext('/sign-up', '?next=%2Forder%2Fcustomize%2Fabc')).toBe('/sign-up?next=%2Forder%2Fcustomize%2Fabc')
  })

  it('drops a missing or unsafe next', () => {
    expect(withNext('/sign-up', '')).toBe('/sign-up')
    expect(withNext('/sign-up', '?next=%2F%2Fevil.com')).toBe('/sign-up')
    expect(withNext('/auth/callback', '?next=https%3A%2F%2Fevil.com')).toBe('/auth/callback')
  })
})

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
