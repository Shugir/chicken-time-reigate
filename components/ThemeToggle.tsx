'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-9 h-9 flex items-center justify-center rounded-full transition-colors
                 text-zinc-500 hover:text-zinc-300 hover:bg-white/5
                 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
