import { describe, it, expect } from 'vitest'
import { resolveTheme, buildThemeInitScript, THEME_STORAGE_KEY } from './theme'

// Runs the pre-paint blocking script's actual generated code against a
// mocked localStorage/window/document, and reports whether it added the
// 'dark' class -- proving the script's precedence logic matches
// resolveTheme() rather than trusting the two to stay in sync by hand.
function runInitScript(stored: string | null, prefersDark: boolean): boolean {
  const classList = new Set<string>()
  const mockLocalStorage = {
    getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
  }
  const mockWindow = { matchMedia: () => ({ matches: prefersDark }) }
  const mockDocument = { documentElement: { classList: { add: (c: string) => classList.add(c) } } }

  const run = new Function('localStorage', 'window', 'document', buildThemeInitScript())
  run(mockLocalStorage, mockWindow, mockDocument)
  return classList.has('dark')
}

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

describe('buildThemeInitScript', () => {
  const cases: Array<[string | null, boolean]> = [
    ['light', true], ['dark', false],
    [null, true], [null, false],
    ['sepia', true], ['', false],
  ]

  it.each(cases)('matches resolveTheme for stored=%s prefersDark=%s', (stored, prefersDark) => {
    const expectedDark = resolveTheme(stored, prefersDark) === 'dark'
    expect(runInitScript(stored, prefersDark)).toBe(expectedDark)
  })
})
