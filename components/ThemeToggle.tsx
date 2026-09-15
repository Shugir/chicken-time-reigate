'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="w-9 h-9 flex items-center justify-center rounded-full transition-colors
                 text-zinc-500 hover:text-brand-dark hover:bg-black/5
                 dark:hover:text-zinc-300 dark:hover:bg-white/5"
    >
      <Sun size={16} className="hidden dark:block" />
      <Moon size={16} className="dark:hidden" />
    </button>
  )
}
