'use client'

import { Check } from 'lucide-react'

/**
 * One choice in a customizer section. `tone="danger"` marks a removed ingredient
 * (selected = struck through) instead of an added option.
 */
export function Pill({
  label, hint, description, badge, selected, disabled = false, tone = 'brand', onClick,
}: {
  label: string
  hint?: string
  description?: string
  badge?: string
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
        {badge && <OptionBadge text={badge} />}
      </span>
      {description && (
        <span className={`block text-xs mt-0.5 ${disabled ? 'text-zinc-400' : 'text-zinc-500'}`}>{description}</span>
      )}
      {hint && (
        <span className={`block text-xs mt-0.5 ${disabled ? 'text-zinc-400' : selected && !danger ? 'text-brand-dark/70' : 'text-zinc-400'}`}>
          {hint}
        </span>
      )}
    </button>
  )
}

/** Short highlight tag on an option, e.g. "Chef Choice" or "15,000 SHU". */
export function OptionBadge({ text }: { text: string }) {
  return (
    <span className="shrink-0 text-[10px] font-bold leading-none px-1.5 py-1 rounded bg-brand-red/10 text-brand-red">
      {text}
    </span>
  )
}

export default function ModifierSection({
  title, subtitle, number, children,
}: {
  title: string
  subtitle?: string
  /** Step number shown as a circle badge before the title. */
  number?: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="bg-brand-red px-5 py-2.5 flex items-center gap-3">
        {number != null && (
          <span
            aria-hidden="true"
            className="w-7 h-7 shrink-0 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center tabular-nums"
          >
            {number}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-heading font-semibold text-white text-sm">{title}</p>
          {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
