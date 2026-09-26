'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Pencil } from 'lucide-react'
import type { Extra, SelectMode } from './types'
import { ADD_BTN_CLS, FOCUS_RING, TAG_INPUT_CLS } from './constants'

// ─── Extra Name Input (autocomplete for option / tag names) ───────────────────

export function ExtraNameInput({ value, onChange, onEnter, suggestions, placeholder, ariaLabel }: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  suggestions: string[]
  placeholder?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions

  useEffect(() => {
    if (open && containerRef.current) setRect(containerRef.current.getBoundingClientRect())
  }, [open, value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) {
        onChange(filtered[activeIdx]); setOpen(false); setActiveIdx(-1)
      } else {
        onEnter(); setOpen(false)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      if (open) e.stopPropagation()
      setOpen(false)
    }
  }

  // The list is fixed-position: follow the input while the page scrolls
  useEffect(() => {
    if (!open) return
    const follow = () => { if (containerRef.current) setRect(containerRef.current.getBoundingClientRect()) }
    window.addEventListener('scroll', follow, true)
    return () => window.removeEventListener('scroll', follow, true)
  }, [open])

  const dropdown = open && filtered.length > 0 && rect
    ? createPortal(
      <div
        style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
        className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
      >
        {filtered.map((s, i) => (
          <button
            key={s}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); setActiveIdx(-1) }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === activeIdx ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}`}
          >
            {s}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null

  return (
    <div ref={containerRef} className="flex-1 min-w-0 relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={`w-full ${TAG_INPUT_CLS}`}
      />
      {dropdown}
    </div>
  )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

export function SelectStyle({ value, onChange }: { value: SelectMode; onChange: (m: SelectMode) => void }) {
  const options: { value: SelectMode; label: string }[] = [
    { value: 'single', label: 'Choose one' },
    { value: 'pick', label: 'Tick several' },
    { value: 'multi', label: 'Tick + quantity' },
  ]
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="text-xs text-zinc-400">Customer picks</span>
      <div role="radiogroup" aria-label="Selection style" className="inline-flex p-0.5 rounded-lg bg-zinc-900 border border-zinc-700">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 px-3 rounded-md text-xs font-medium transition-colors ${FOCUS_RING} ${value === o.value ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DuplicateWarning({ name, labels }: { name: string; labels: string[] }) {
  if (!name || labels.length === 0) return null
  return (
    <p className="text-xs text-amber-400">
      &ldquo;{name}&rdquo; is also in {labels.join(', ')}. Sold-out (86) applies by name across all categories.
    </p>
  )
}

// Free-text tag list (ingredients)
export function TagSection({ title, placeholder, items, onChange, suggestions, warnFor }: {
  title: string
  placeholder: string
  items: string[]
  onChange: (next: string[]) => void
  suggestions: string[]
  warnFor?: (name: string) => string[]
}) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim()
    if (!val || items.includes(val)) return
    onChange([...items, val])
    setInput('')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <ExtraNameInput value={input} onChange={setInput} onEnter={add} suggestions={suggestions} placeholder={placeholder} ariaLabel={`Add to ${title}`} />
        <button type="button" onClick={add} aria-label={`Add to ${title}`} className={ADD_BTN_CLS}><Plus className="w-4 h-4" /></button>
      </div>
      {warnFor && <DuplicateWarning name={input.trim()} labels={warnFor(input.trim())} />}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-zinc-700/50 text-zinc-100 text-sm pl-3 pr-1 py-1 rounded-full">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(items.filter((x) => x !== t))} className={`h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-600 transition-colors ${FOCUS_RING}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Priced option lists ──────────────────────────────────────────────────────

export interface OptionDraft { name: string; price: string; description: string; badge: string }
const EMPTY_DRAFT: OptionDraft = { name: '', price: '', description: '', badge: '' }
const PRICE_INPUT_CLS = `w-full pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`

const toDraft = (ex: Extra): OptionDraft =>
  ({ name: ex.name, price: ex.price.toFixed(2), description: ex.description ?? '', badge: ex.badge ?? '' })

/** null when the name is empty or the price is not a number >= 0. A blank price is 0 only when `priceOptional`. */
export function draftToExtra(d: OptionDraft, priceOptional: boolean): Extra | null {
  const name = d.name.trim()
  const price = priceOptional && d.price.trim() === '' ? 0 : parseFloat(d.price)
  if (!name || isNaN(price) || price < 0) return null
  const description = d.description.trim()
  const badge = d.badge.trim()
  return { name, price, ...(description && { description }), ...(badge && { badge }) }
}

export function PriceInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <div className="relative w-24 shrink-0">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">£</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } }}
        placeholder="0.00"
        aria-label="Price"
        className={PRICE_INPUT_CLS}
      />
    </div>
  )
}

// Optional subtitle and highlight tag shown to customers under/next to the option name
export function DetailInputs({ draft, setDraft, onEnter }: {
  draft: OptionDraft
  setDraft: (fn: (d: OptionDraft) => OptionDraft) => void
  onEnter: () => void
}) {
  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } }
  return (
    <div className="grid grid-cols-[1fr_8rem] gap-2">
      <input
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        onKeyDown={onKeyDown}
        maxLength={80}
        placeholder="Description (optional)"
        aria-label="Description"
        className={`w-full ${TAG_INPUT_CLS}`}
      />
      <input
        value={draft.badge}
        onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))}
        onKeyDown={onKeyDown}
        maxLength={20}
        placeholder="Badge"
        aria-label="Badge"
        className={`w-full ${TAG_INPUT_CLS}`}
      />
    </div>
  )
}

// Priced {name, price, description?, badge?} list with inline edit and 86 (sold-out) toggle.
// `isSpicy`: the customer always picks one spicy level (order_items.spicy_level is a single
// text column) and checkout does not apply 86 to it, so the mode and 86 controls are hidden.
export function PricedSection({ title, placeholder, items, onChange, soldOut, onToggle86, onRename, suggestions, mode, onModeChange, warnFor, isSpicy = false }: {
  title: string
  placeholder: string
  items: Extra[]
  onChange: (next: Extra[]) => void
  soldOut: string[]
  onToggle86: (name: string) => void
  onRename: (from: string, to: string) => void
  suggestions: string[]
  mode: SelectMode
  onModeChange: (m: SelectMode) => void
  warnFor: (name: string) => string[]
  isSpicy?: boolean
}) {
  const [input, setInput] = useState<OptionDraft>(EMPTY_DRAFT)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<OptionDraft>(EMPTY_DRAFT)
  const [editError, setEditError] = useState<string | null>(null)

  function add() {
    const next = draftToExtra(input, isSpicy)
    if (!next || items.some((e) => e.name === next.name)) return
    onChange([...items, next])
    setInput(EMPTY_DRAFT)
  }

  function startEdit(ex: Extra) {
    setEditing(ex.name)
    setDraft(toDraft(ex))
    setEditError(null)
  }

  function saveEdit() {
    if (editing === null) return
    const next = draftToExtra(draft, isSpicy)
    if (!next) return setEditError('Enter a name and a price of 0 or more.')
    if (next.name !== editing && items.some((e) => e.name === next.name)) return setEditError(`${next.name} is already in ${title}.`)
    onChange(items.map((e) => (e.name === editing ? next : e)))
    if (next.name !== editing) onRename(editing, next.name)
    setEditing(null)
  }

  return (
    <div className="space-y-3">
      {isSpicy
        ? <p className="text-xs text-zinc-400">Customers always pick one spicy level.</p>
        : <SelectStyle value={mode} onChange={onModeChange} />}
      <div className="flex gap-2">
        <ExtraNameInput
          value={input.name}
          onChange={(v) => setInput((x) => ({ ...x, name: v }))}
          onEnter={add}
          suggestions={suggestions}
          placeholder={placeholder}
          ariaLabel={`New option name for ${title}`}
        />
        <PriceInput value={input.price} onChange={(v) => setInput((x) => ({ ...x, price: v }))} onEnter={add} />
        <button type="button" onClick={add} aria-label={`Add to ${title}`} className={ADD_BTN_CLS}><Plus className="w-4 h-4" /></button>
      </div>
      <DetailInputs draft={input} setDraft={setInput} onEnter={add} />
      <DuplicateWarning name={input.name.trim()} labels={warnFor(input.name.trim())} />
      {items.length > 0 && (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
          {items.map((ex) => {
            const is86 = !isSpicy && soldOut.includes(ex.name)
            if (editing === ex.name) {
              return (
                <li key={ex.name} className="space-y-2 px-3 py-3 bg-zinc-800/40">
                  <div className="flex gap-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } }}
                      aria-label="Name"
                      autoFocus
                      className={`flex-1 min-w-0 ${TAG_INPUT_CLS}`}
                    />
                    <PriceInput value={draft.price} onChange={(v) => setDraft((d) => ({ ...d, price: v }))} onEnter={saveEdit} />
                  </div>
                  <DetailInputs draft={draft} setDraft={setDraft} onEnter={saveEdit} />
                  {editError && <p role="alert" className="text-xs text-red-400">{editError}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className={`h-11 px-4 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors ${FOCUS_RING}`}>
                      Cancel
                    </button>
                    <button type="button" onClick={saveEdit} className={`h-11 px-4 rounded-lg text-xs font-semibold bg-zinc-600 hover:bg-zinc-500 text-white transition-colors ${FOCUS_RING}`}>
                      Save
                    </button>
                  </div>
                </li>
              )
            }
            return (
              <li key={ex.name} className="flex items-center gap-2 px-3 py-1">
                <button
                  type="button"
                  onClick={() => startEdit(ex)}
                  aria-label={`Edit ${ex.name}`}
                  className={`flex-1 min-w-0 min-h-11 text-left rounded-md -mx-1 px-1 py-1 hover:bg-zinc-800 transition-colors ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`truncate text-sm ${is86 ? 'text-amber-300 line-through' : 'text-zinc-100'}`}>{ex.name}</span>
                    {ex.badge && <span className="shrink-0 text-[10px] font-semibold text-zinc-200 bg-zinc-700/70 rounded px-1.5 py-0.5">{ex.badge}</span>}
                    <Pencil className="shrink-0 w-3 h-3 text-zinc-500" aria-hidden="true" />
                  </span>
                  {ex.description && <span className="block truncate text-xs text-zinc-400">{ex.description}</span>}
                </button>
                <span className={`text-sm tabular-nums ${is86 ? 'text-amber-500' : ex.price === 0 ? 'text-zinc-400' : 'text-zinc-300'}`}>
                  {ex.price === 0 ? 'Free' : `+£${ex.price.toFixed(2)}`}
                </span>
                {!isSpicy && (
                  <button
                    type="button"
                    aria-pressed={is86}
                    aria-label={is86 ? `${ex.name} is sold out. Mark available again` : `Mark ${ex.name} sold out (86)`}
                    title={is86 ? 'Mark available again' : 'Mark sold out (86)'}
                    onClick={() => onToggle86(ex.name)}
                    className={`min-h-11 min-w-11 text-[11px] font-semibold px-2 rounded-md border transition-colors ${FOCUS_RING} ${is86 ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40'}`}
                  >
                    {is86 ? 'Sold out' : '86'}
                  </button>
                )}
                <button type="button" aria-label={`Remove ${ex.name}`} onClick={() => onChange(items.filter((x) => x.name !== ex.name))} className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors ${FOCUS_RING}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
