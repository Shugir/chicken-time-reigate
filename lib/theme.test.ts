import { describe, it, expect } from 'vitest'
import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('uses the stored value when present, ignoring system preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('falls back to system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })

  it('falls back to system preference when the stored value is garbage', () => {
    expect(resolveTheme('sepia', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})
