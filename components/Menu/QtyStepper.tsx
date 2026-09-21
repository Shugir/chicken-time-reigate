'use client'

import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  onChange: (next: number) => void
  /** Option name, used for the buttons' screen-reader labels. */
  label: string
  min?: number
  max?: number
  disabled?: boolean
}

export default function QtyStepper({ value, onChange, label, min = 0, max = 20, disabled = false }: Props) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Remove one ${label}`}
        className="w-11 h-11 rounded-full border-2 border-zinc-200 text-zinc-600 flex items-center justify-center hover:border-zinc-400 disabled:opacity-30 disabled:hover:border-zinc-200 transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="w-7 text-center text-sm font-bold text-zinc-900 tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Add one ${label}`}
        className="w-11 h-11 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-900 transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
