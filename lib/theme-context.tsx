'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from './theme'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(resolveTheme(stored, prefersDark))
  }, [])

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  function toggle() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
