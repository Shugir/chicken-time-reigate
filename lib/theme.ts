export const THEME_STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark'

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

// Pre-paint blocking script for app/layout.tsx <head>. Its precedence logic
// must match resolveTheme() exactly, or a mismatch reintroduces flash-of-
// wrong-theme. Kept here (not inlined in layout.tsx) so lib/theme.test.ts
// can execute it and assert equivalence against resolveTheme.
export function buildThemeInitScript(): string {
  return `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored === 'light' || stored === 'dark') ? stored : (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`
}
