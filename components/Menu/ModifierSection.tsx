'use client'

import { Check } from 'lucide-react'

/**
 * One choice in a customizer section. `tone="danger"` marks a removed ingredient
 * (selected = struck through) instead of an added option.
 */
export function Pill({
  label, hint, selected, disabled = false, tone = 'brand', onClick,
}: {
  label: string
  hint?: string
  selected: boolean
  disabled?: boolean
  tone?: 'brand' | 'danger'
  onClick: () => void
}) {
  const danger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`min-h-[44px] text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${
        disabled
          ? 'border-zinc-100 opacity-50 cursor-not-allowed'
          : selected
            ? danger ? 'border-red-200 bg-red-50' : 'border-brand-yellow bg-brand-yellow/20'
            : 'border-zinc-200 hover:border-zinc-400 active:scale-[0.98]'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {selected && !danger && <Check size={12} className="text-brand-dark shrink-0" />}
        <span
          className={`font-semibold text-sm ${
            disabled ? 'text-zinc-400' : selected ? (danger ? 'text-red-600 line-through' : 'text-brand-dark') : 'text-zinc-800'
          }`}
        >
          {label}
        </span>
      </span>
      {hint && (
        <span className={`block text-xs mt-0.5 ${disabled ? 'text-zinc-400' : selected && !danger ? 'text-brand-dark/70' : 'text-zinc-400'}`}>
          {hint}
        </span>
      )}
    </button>
  )
}

export default function ModifierSection({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="bg-brand-red px-5 py-2.5">
        <p className="font-heading font-semibold text-white text-sm">{title}</p>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
