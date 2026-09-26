'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  UtensilsCrossed,
  Plus,
  X,
  Check,
  Loader2,
  Pencil,
  Trash2,
  ChevronDown,
  Image as ImageIcon,
  Search,
  LayoutGrid,
  List,
  UploadCloud,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Extra {
  name: string
  price: number
  /** short subtitle shown to customers */
  description?: string
  /** short highlight tag, e.g. "Chef Choice" */
  badge?: string
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  compare_at_price: number | null
  image_url: string | null
  category: string
  is_available: boolean
  sold_out_extras: string[]
  /** @deprecated use add_ons */
  extras: Extra[]
  /** @deprecated use ingredients */
  removals: string[]
  additions: string[]
  spicy_levels: Extra[]
  ingredients: string[]
  extra_ingredients: Extra[]
  add_ons: Extra[]
  drinks_regular: Extra[]
  drinks_large: Extra[]
  dips: Extra[]
  sides: Extra[]
  fries_regular: Extra[]
  fries_large: Extra[]
  other_extras: Extra[]
  modifier_select_modes: Record<string, 'single' | 'multi' | 'pick'>
  dietary_flags: string[]
  allergens: string[]
  created_at: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface DbCategory { id: string; name: string; slug: string; sort_order: number; is_active: boolean }

const DIETARY_FLAGS = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Spicy', 'Nut-Free']
const COMMON_ALLERGENS = ['Celery', 'Crustaceans', 'Dairy', 'Eggs', 'Fish', 'Gluten', 'Lupin', 'Molluscs', 'Mustard', 'Nuts', 'Peanuts', 'Sesame', 'Soya', 'Sulphites']

const COLOUR_PALETTE = [
  'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
  'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
  'bg-lime-500/15 text-lime-300 ring-1 ring-lime-500/30',
  'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
  'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30',
  'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
]

// ─── Inline Price Cell ────────────────────────────────────────────────────────

function PriceCell({ item, onSave }: { item: MenuItem; onSave: (id: string, price: number) => Promise<void> }) {
  const [value, setValue] = useState(item.price.toFixed(2))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(item.price.toFixed(2))
  }, [item.price])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setSaveState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const parsed = parseFloat(e.target.value)
      if (isNaN(parsed) || parsed < 0) return
      setSaveState('saving')
      try {
        await onSave(item.id, parsed)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1500)
      } catch {
        setSaveState('error')
      }
    }, 800)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400 text-sm">£</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={handleChange}
        className="w-20 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-white
                   focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red
                   [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {saveState === 'saving' && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
      {saveState === 'saved' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
      {saveState === 'error' && <X className="w-3.5 h-3.5 text-red-400" />}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function AvailabilityToggle({
  item,
  onToggle,
}: {
  item: MenuItem
  onToggle: (id: string, val: boolean) => Promise<void>
}) {
  const [optimistic, setOptimistic] = useState(item.is_available)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setOptimistic(item.is_available) }, [item.is_available])

  const handleClick = async () => {
    if (busy) return
    const next = !optimistic
    setOptimistic(next)
    setBusy(true)
    try {
      await onToggle(item.id, next)
    } catch {
      setOptimistic(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors
                  focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-zinc-900
                  disabled:opacity-50 ${optimistic ? 'bg-emerald-500' : 'bg-zinc-700'}`}
      aria-label={optimistic ? 'Disable item' : 'Enable item'}
    >
      <span
        className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
                    ${optimistic ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

// ─── Autocomplete Input (shared by both removals and extras name) ─────────────

const INPUT_BASE = 'bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red transition-colors'
const TAG_INPUT_CLS = `${INPUT_BASE} h-11`

// ─── Extra Name Input (autocomplete for extras name field) ────────────────────

function ExtraNameInput({ value, onChange, onEnter, suggestions, placeholder }: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  suggestions: string[]
  placeholder?: string
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
      // Close the suggestion list only; a second Escape then closes the modal
      if (open) e.stopPropagation()
      setOpen(false)
    }
  }

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
    <div ref={containerRef} className="flex-1 relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full ${TAG_INPUT_CLS}`}
      />
      {dropdown}
    </div>
  )
}

// ─── Modifier sections ────────────────────────────────────────────────────────

type SelectMode = 'single' | 'multi' | 'pick'

const PRICED_CATEGORIES = [
  { key: 'spicy_levels', label: 'Spicy Level', hint: 'Heat options — price optional', placeholder: 'e.g. Reaper Inferno' },
  { key: 'extra_ingredients', label: 'Extra Ingredients', hint: 'Shown in 1.3 Extra Ingredients with a price', placeholder: 'e.g. Extra Cheese' },
  { key: 'drinks_regular', label: 'Drinks (Regular)', hint: 'Regular-size drinks', placeholder: 'e.g. Coke' },
  { key: 'drinks_large', label: 'Drinks (Large)', hint: 'Large-size drinks', placeholder: 'e.g. Large Coke' },
  { key: 'sides', label: 'Sides', hint: 'Side dishes', placeholder: 'e.g. Coleslaw' },
  { key: 'fries_regular', label: 'Fries (Regular)', hint: 'Regular-size fries', placeholder: 'e.g. Peri Fries' },
  { key: 'fries_large', label: 'Fries (Large)', hint: 'Large-size fries', placeholder: 'e.g. Large Peri Fries' },
  { key: 'dips', label: 'Dips', hint: 'Dips and sauces', placeholder: 'e.g. Garlic Mayo' },
  { key: 'add_ons', label: 'Add-ons', hint: 'Extras customers can add', placeholder: 'e.g. Bacon' },
  { key: 'other_extras', label: 'Other Extras', hint: 'Anything that fits no other category', placeholder: 'e.g. Cutlery Pack' },
] as const

type PricedKey = (typeof PRICED_CATEGORIES)[number]['key']

// Matches the migration default for menu_items.modifier_select_modes
const DEFAULT_SELECT_MODES: Record<string, SelectMode> = {
  spicy_levels: 'single', dips: 'single', fries_regular: 'single', fries_large: 'single',
  add_ons: 'multi', drinks_regular: 'multi', drinks_large: 'multi', sides: 'multi', other_extras: 'multi',
  extra_ingredients: 'multi',
}

const LABEL_CLS = 'block text-xs font-medium text-zinc-400 mb-1.5'
const ADD_BTN_CLS = 'shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white transition-colors'

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-white px-0.5">{title}</h3>
      {children}
    </section>
  )
}

// Collapsible row: empty categories stay compact, populated ones open on first render
function Disclosure({ title, hint, count, children }: {
  title: string
  hint: string
  count: number
  children: React.ReactNode
}) {
  const [initiallyOpen] = useState(count > 0)
  return (
    <details open={initiallyOpen} className="group rounded-2xl border border-zinc-800 bg-zinc-800/30">
      <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block text-xs text-zinc-500 truncate">{hint}</span>
        </span>
        {count > 0 && (
          <span className="text-xs font-medium text-zinc-200 bg-zinc-700/70 rounded-full px-2 py-0.5 tabular-nums">{count}</span>
        )}
        <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </details>
  )
}

function SelectStyle({ value, onChange }: { value: SelectMode; onChange: (m: SelectMode) => void }) {
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
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${value === o.value ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DuplicateWarning({ name, labels }: { name: string; labels: string[] }) {
  if (!name || labels.length === 0) return null
  return (
    <p className="text-xs text-amber-400">
      &ldquo;{name}&rdquo; is also in {labels.join(', ')}. Sold-out (86) applies by name across all categories.
    </p>
  )
}

// Free-text tag list (ingredients, additions)
function TagSection({ title, hint, placeholder, items, onChange, suggestions, warnFor }: {
  title: string
  hint: string
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
    <Disclosure title={title} hint={hint} count={items.length}>
      <div className="flex gap-2">
        <ExtraNameInput value={input} onChange={setInput} onEnter={add} suggestions={suggestions} placeholder={placeholder} />
        <button type="button" onClick={add} aria-label={`Add to ${title}`} className={ADD_BTN_CLS}><Plus className="w-4 h-4" /></button>
      </div>
      {warnFor && <DuplicateWarning name={input.trim()} labels={warnFor(input.trim())} />}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-zinc-700/50 text-zinc-100 text-sm pl-3 pr-1.5 py-1 rounded-full">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(items.filter((x) => x !== t))} className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-600 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Disclosure>
  )
}

interface OptionDraft { name: string; price: string; description: string; badge: string }
const EMPTY_DRAFT: OptionDraft = { name: '', price: '', description: '', badge: '' }
const PRICE_INPUT_CLS = `w-full pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`

const toDraft = (ex: Extra): OptionDraft =>
  ({ name: ex.name, price: ex.price.toFixed(2), description: ex.description ?? '', badge: ex.badge ?? '' })

/** null when the name is empty or the price is not a number >= 0. A blank price is 0 only when `priceOptional`. */
function draftToExtra(d: OptionDraft, priceOptional: boolean): Extra | null {
  const name = d.name.trim()
  const price = priceOptional && d.price.trim() === '' ? 0 : parseFloat(d.price)
  if (!name || isNaN(price) || price < 0) return null
  const description = d.description.trim()
  const badge = d.badge.trim()
  return { name, price, ...(description && { description }), ...(badge && { badge }) }
}

function PriceInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
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
function DetailInputs({ draft, setDraft, onEnter }: {
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
function PricedSection({ title, hint, placeholder, items, onChange, soldOut, onToggle86, onRename, suggestions, mode, onModeChange, warnFor, isSpicy = false }: {
  title: string
  hint: string
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
    <Disclosure title={title} hint={hint} count={items.length}>
      {isSpicy
        ? <p className="text-xs text-zinc-500">Customers always pick one spicy level.</p>
        : <SelectStyle value={mode} onChange={onModeChange} />}
      <div className="flex gap-2">
        <ExtraNameInput
          value={input.name}
          onChange={(v) => setInput((x) => ({ ...x, name: v }))}
          onEnter={add}
          suggestions={suggestions}
          placeholder={placeholder}
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
                    <button type="button" onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={saveEdit} className="h-9 px-3 rounded-lg text-xs font-semibold bg-zinc-600 hover:bg-zinc-500 text-white transition-colors">
                      Save
                    </button>
                  </div>
                </li>
              )
            }
            return (
              <li key={ex.name} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => startEdit(ex)}
                  title="Edit"
                  className="flex-1 min-w-0 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`truncate text-sm ${is86 ? 'text-amber-300 line-through' : 'text-zinc-100'}`}>{ex.name}</span>
                    {ex.badge && <span className="shrink-0 text-[10px] font-semibold text-zinc-200 bg-zinc-700/70 rounded px-1.5 py-0.5">{ex.badge}</span>}
                    <Pencil className="shrink-0 w-3 h-3 text-zinc-600" aria-hidden="true" />
                  </span>
                  {ex.description && <span className="block truncate text-xs text-zinc-500">{ex.description}</span>}
                </button>
                <span className={`text-sm tabular-nums ${is86 ? 'text-amber-500' : ex.price === 0 ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  {ex.price === 0 ? 'Free' : `+£${ex.price.toFixed(2)}`}
                </span>
                {!isSpicy && (
                  <button
                    type="button"
                    aria-pressed={is86}
                    title={is86 ? 'Mark available again' : 'Mark sold out (86)'}
                    onClick={() => onToggle86(ex.name)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors ${is86 ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-500/40'}`}
                  >
                    {is86 ? 'Sold out' : '86'}
                  </button>
                )}
                <button type="button" aria-label={`Remove ${ex.name}`} onClick={() => onChange(items.filter((x) => x.name !== ex.name))} className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Disclosure>
  )
}

// ─── Item Modal (add + edit) ──────────────────────────────────────────────────

interface ItemModalProps {
  editingItem: MenuItem | null
  categories: DbCategory[]
  onClose: () => void
  onSave: (item: MenuItem) => void
}

const EMPTY_FORM = { name: '', description: '', price: '', compare_at_price: '', image_url: '', category: '' }

function ItemModal({ editingItem, categories, onClose, onSave }: ItemModalProps) {
  const [form, setForm] = useState(() =>
    editingItem
      ? {
        name: editingItem.name,
        description: editingItem.description ?? '',
        price: editingItem.price.toFixed(2),
        compare_at_price: editingItem.compare_at_price != null ? editingItem.compare_at_price.toFixed(2) : '',
        image_url: editingItem.image_url ?? '',
        category: editingItem.category,
      }
      : { ...EMPTY_FORM, category: categories[0]?.slug ?? '' }
  )
  const [ingredients, setIngredients] = useState<string[]>(() => editingItem?.ingredients ?? [])
  const [additions, setAdditions] = useState<string[]>(() => editingItem?.additions ?? [])
  const [priced, setPriced] = useState<Record<PricedKey, Extra[]>>(() =>
    Object.fromEntries(PRICED_CATEGORIES.map((c) => [c.key, editingItem?.[c.key] ?? []])) as Record<PricedKey, Extra[]>
  )
  const [modes, setModes] = useState<Record<string, SelectMode>>(() => ({ ...DEFAULT_SELECT_MODES, ...editingItem?.modifier_select_modes }))
  const [soldOutExtras, setSoldOutExtras] = useState<string[]>(() => editingItem?.sold_out_extras ?? [])
  const [dietaryFlags, setDietaryFlags] = useState<string[]>(() => editingItem?.dietary_flags ?? [])
  const [allergens, setAllergens] = useState<string[]>(() => editingItem?.allergens ?? [])
  const [allergenInput, setAllergenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{ removals: string[]; additions: string[]; extras: string[]; allergens: string[] }>({ removals: [], additions: [], extras: [], allergens: [] })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [onClose])

  useEffect(() => {
    fetch('/api/admin/menu/suggestions')
      .then((r) => r.json())
      .then((d) => setSuggestions({
        removals: Array.isArray(d?.removals) ? d.removals : [],
        additions: Array.isArray(d?.additions) ? d.additions : [],
        extras: Array.isArray(d?.extras) ? d.extras : [],
        allergens: Array.isArray(d?.allergens) ? d.allergens : [],
      }))
      .catch(() => { })
  }, [])

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  // Labels of other categories (priced + ingredients) already using this name
  function labelsUsing(name: string, exceptKey: string): string[] {
    if (!name) return []
    const labels: string[] = PRICED_CATEGORIES
      .filter((c) => c.key !== exceptKey && priced[c.key].some((e) => e.name === name))
      .map((c) => c.label)
    if (exceptKey !== 'ingredients' && ingredients.includes(name)) labels.push('Ingredients')
    return labels
  }

  function addAllergen() {
    const val = allergenInput.trim()
    if (!val || allergens.includes(val)) return
    setAllergens((prev) => [...prev, val])
    setAllergenInput('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setForm((f) => ({ ...f, image_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = parseFloat(form.price)
    if (!form.name.trim()) return setError('Name is required.')
    if (isNaN(parsed) || parsed <= 0) return setError('Enter a valid price.')
    if (!form.category) return setError('Category is required.')

    // Upload file first if one was selected; its URL takes priority over the text field
    let resolvedImageUrl = form.image_url.trim() || null
    if (imageFile) {
      setImageUploading(true)
      const fd = new FormData()
      fd.append('file', imageFile)
      const uploadRes = await fetch('/api/admin/menu/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      setImageUploading(false)
      if (!uploadRes.ok) return setError(`Image upload failed: ${uploadData.error ?? 'Unknown error'}`)
      resolvedImageUrl = uploadData.url
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parsed,
      compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price as string) || null : null,
      image_url: resolvedImageUrl,
      category: form.category,
      is_available: editingItem ? editingItem.is_available : true,
      // sold_out_extras matches by name against the union of all priced categories
      sold_out_extras: soldOutExtras.filter(n => PRICED_CATEGORIES.some(c => priced[c.key].some(e => e.name === n))),
      additions,
      ingredients,
      ...priced,
      modifier_select_modes: modes,
      dietary_flags: dietaryFlags,
      allergens,
    }

    setSaving(true)
    try {
      const url = editingItem ? `/api/admin/menu-items/${editingItem.id}` : '/api/admin/menu-items'
      const method = editingItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? (editingItem ? 'Failed to update item' : 'Failed to add item'))
      onSave(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="item-modal-title" className="flex flex-col w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[88vh] bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 id="item-modal-title" className="text-lg font-semibold text-white">{editingItem ? 'Edit item' : 'New menu item'}</h2>
            {editingItem && <p className="text-xs text-zinc-500 truncate">{editingItem.name}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form id="item-form" onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain flex-1 px-5 sm:px-7 py-6 space-y-8">
          <FormSection title="Photo">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* 4:3 + object-cover: the same crop as the customer store card (app/order MenuCard) */}
              <div className="relative w-full sm:w-56 aspect-[4/3] shrink-0 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                {(imagePreview || form.image_url) ? (
                  <>
                    <Image src={imagePreview ?? form.image_url} alt="Preview" fill className="object-cover" sizes="(max-width: 640px) 100vw, 224px" unoptimized />
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <label className={`flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-dashed text-sm font-medium transition-colors
                  ${imageUploading ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' : 'border-zinc-600 text-zinc-300 hover:border-brand-red hover:text-white cursor-pointer'}`}>
                  {imageUploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><UploadCloud className="w-4 h-4" /> Upload photo</>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={imageUploading}
                    onChange={handleFileChange}
                  />
                </label>
                <input
                  {...field('image_url')}
                  type="url"
                  placeholder="Or paste an image URL"
                  aria-label="Image URL"
                  className={`w-full ${TAG_INPUT_CLS}`}
                  disabled={!!imageFile}
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Shown as 4:3 on the store, cropped to fill. Best at 1200 × 900 px.
              {imageFile && ' The uploaded photo replaces the URL.'}
            </p>
          </FormSection>

          <FormSection title="Details">
            <div>
              <label className={LABEL_CLS}>Name <span className="text-red-400">*</span></label>
              <input {...field('name')} placeholder="e.g. Spicy Chicken Burger" className={`w-full ${TAG_INPUT_CLS}`} />
            </div>
            <div>
              <label className={LABEL_CLS}>Description</label>
              <textarea
                {...field('description')}
                rows={2}
                placeholder="Short description of the item"
                className={`w-full resize-none py-2.5 ${INPUT_BASE}`}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Price (£) <span className="text-red-400">*</span></label>
                <input
                  {...field('price')}
                  type="number" step="0.01" min="0" placeholder="0.00"
                  className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Category <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select {...field('category')} className={`w-full appearance-none pr-9 ${TAG_INPUT_CLS}`}>
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Compare-at price (optional)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.compare_at_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, compare_at_price: e.target.value }))}
                  className={`w-full pl-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${TAG_INPUT_CLS}`}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                If higher than the price, the menu shows an offer badge with the original price crossed out.
              </p>
            </div>
          </FormSection>

          <FormSection title="Customisation">
            <p className="text-xs text-zinc-500 -mt-1 px-0.5">Choose what customers can change on this item. Categories with entries open automatically.</p>
            <div className="space-y-2">
              <TagSection
                title="Ingredients"
                hint="Included by default; customers can deselect"
                placeholder="e.g. Pickles"
                items={ingredients}
                onChange={setIngredients}
                suggestions={suggestions.removals}
                warnFor={(n) => labelsUsing(n, 'ingredients')}
              />
              <TagSection
                title="Extra ingredients (free)"
                hint="Shown in 1.3 Extra Ingredients at £0.00"
                placeholder="e.g. Extra Sauce"
                items={additions}
                onChange={setAdditions}
                suggestions={suggestions.additions}
              />
              {PRICED_CATEGORIES.map((c) => (
                <PricedSection
                  key={c.key}
                  title={c.label}
                  hint={c.hint}
                  placeholder={c.placeholder}
                  items={priced[c.key]}
                  onChange={(next) => setPriced((prev) => ({ ...prev, [c.key]: next }))}
                  soldOut={soldOutExtras}
                  onToggle86={(name) => setSoldOutExtras((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
                  // 86 is by name: carry it to the new name. The old name is pruned on save if nothing else uses it.
                  onRename={(from, to) => setSoldOutExtras((prev) => prev.includes(from) && !prev.includes(to) ? [...prev, to] : prev)}
                  suggestions={c.key === 'spicy_levels' ? [] : suggestions.extras}
                  mode={modes[c.key]}
                  onModeChange={(m) => setModes((prev) => ({ ...prev, [c.key]: m }))}
                  warnFor={(n) => labelsUsing(n, c.key)}
                  isSpicy={c.key === 'spicy_levels'}
                />
              ))}
            </div>
          </FormSection>

          <FormSection title="Dietary and allergens">
            <div>
              <p className={LABEL_CLS}>Dietary flags</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_FLAGS.map((flag) => {
                  const active = dietaryFlags.includes(flag)
                  return (
                    <button
                      key={flag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDietaryFlags((prev) => active ? prev.filter((f) => f !== flag) : [...prev, flag])}
                      className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-colors border ${active
                        ? 'bg-brand-red/20 border-brand-red/50 text-red-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                    >
                      {flag}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className={LABEL_CLS}>Allergens shown to customers</label>
              <div className="flex gap-2">
                <ExtraNameInput
                  value={allergenInput}
                  onChange={setAllergenInput}
                  onEnter={addAllergen}
                  suggestions={[...new Set([...COMMON_ALLERGENS, ...suggestions.allergens])]}
                  placeholder="e.g. Gluten, Dairy, Nuts…"
                />
                <button type="button" onClick={addAllergen} aria-label="Add allergen" className={ADD_BTN_CLS}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {allergens.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {allergens.map((a) => (
                    <span key={a} className="flex items-center gap-1 bg-amber-900/30 text-amber-200 border border-amber-700/40 text-sm pl-3 pr-1.5 py-1 rounded-full">
                      {a}
                      <button type="button" aria-label={`Remove ${a}`} onClick={() => setAllergens((prev) => prev.filter((x) => x !== a))} className="p-1 rounded-full text-amber-400 hover:text-white hover:bg-amber-800/50 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </FormSection>
        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-800 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
          {error && (
            <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="item-form"
              disabled={saving}
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : editingItem ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ item, onClose, onConfirm }: { item: MenuItem; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Delete "{item.name}"?</h3>
        <p className="text-zinc-400 text-sm mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────


interface QuickStats { revenue_today: number; orders_today: number; active_promotions: number }

export default function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [stats, setStats] = useState<QuickStats | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d) })
      .catch(() => { })
  }, [])

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => { })
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/menu-items')
    const data = await res.json()
    setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const patchItem = async (id: string, patch: Partial<MenuItem>) => {
    const res = await fetch(`/api/admin/menu-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('Save failed')
    const updated: MenuItem = await res.json()
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  const handleToggle = (id: string, val: boolean) => patchItem(id, { is_available: val })
  const handlePriceSave = (id: string, price: number) => patchItem(id, { price })

  const handleSave = (item: MenuItem) =>
    setItems((prev) => prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item])

  const closeModal = () => { setShowAddModal(false); setEditingItem(null) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await fetch(`/api/admin/menu-items/${deleteTarget.id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // Client-side filtering
  const filteredItems = items.filter((i) => {
    const q = searchQuery.toLowerCase().trim()
    if (q && !i.name.toLowerCase().includes(q) && !(i.description ?? '').toLowerCase().includes(q)) return false
    if (catFilter && i.category.toLowerCase() !== catFilter) return false
    if (statusFilter === 'active' && !i.is_available) return false
    if (statusFilter === 'inactive' && i.is_available) return false
    return true
  })

  // Group by category
  const grouped = categories.map((cat, idx) => ({
    cat,
    idx,
    rows: filteredItems.filter((i) => i.category.toLowerCase() === cat.slug),
  })).filter((g) => g.rows.length > 0)

  // Summary stats
  const totalItems = items.length
  const activeItems = items.filter((i) => i.is_available).length

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Menu Manager</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {loading ? 'Loading…' : `${totalItems} items · ${activeItems} active`}
              </p>
            </div>
            <button
              onClick={() => { setEditingItem(null); setShowAddModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30"
            >
              <Plus className="w-4 h-4" />
              Add New Item
            </button>
          </div>

          {/* Bento quick-stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Total Items', value: loading ? '…' : String(totalItems), color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/10' },
              { label: 'Active Promos', value: stats ? String(stats.active_promotions) : '—', color: 'text-violet-400', border: 'border-violet-500/20', bg: 'bg-violet-500/10' },
              { label: 'Out of Stock', value: loading ? '…' : String(items.filter((i) => !i.is_available).length), color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
            ].map(({ label, value, color, border, bg }) => (
              <div key={label} className={`${bg} border ${border} rounded-xl px-4 py-3 flex items-center justify-between`}>
                <span className="text-xs text-zinc-500 font-medium">{label}</span>
                <span className={`text-base font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Control bar */}
        <div className="px-8 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-3 flex-wrap shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red"
            />
          </div>
          {/* Category filter */}
          <div className="relative">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
          </div>
          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <UtensilsCrossed className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-medium">No menu items yet</p>
              <p className="text-zinc-600 text-sm mt-1">Click "Add New Item" to get started.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-medium">No items found</p>
              <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="space-y-8">
              {grouped.map(({ cat, idx, rows }) => (
                <section key={cat.slug}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLOUR_PALETTE[idx % COLOUR_PALETTE.length]}`}>
                      {cat.name}
                    </span>
                    <span className="text-xs text-zinc-600">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {rows.map((item) => (
                      <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all group flex flex-col">
                        <div className="relative h-32 bg-zinc-800 shrink-0">
                          {item.image_url ? (
                            <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-zinc-700" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-blue-400 backdrop-blur-sm" title="Edit">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-red-400 backdrop-blur-sm" title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3 flex flex-col gap-2 flex-1">
                          <div>
                            <p className="text-sm font-semibold text-white leading-tight line-clamp-1">{item.name}</p>
                            {item.description && (
                              <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          {item.dietary_flags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.dietary_flags.map((f) => (
                                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-red/15 text-red-300">{f}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-auto pt-1 border-t border-zinc-800">
                            <PriceCell item={item} onSave={handlePriceSave} />
                            <AvailabilityToggle item={item} onToggle={handleToggle} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ cat, idx, rows }) => (
                <section key={cat.slug}>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLOUR_PALETTE[idx % COLOUR_PALETTE.length]}`}>
                      {cat.name}
                    </span>
                    <span className="text-xs text-zinc-600">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border border-zinc-800 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-zinc-800/90 border-b border-zinc-700/50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide w-12">Image</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide w-36">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide w-28">Available</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wide w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {rows.map((item) => (
                          <tr key={item.id} className="bg-zinc-900 hover:bg-zinc-800/40 transition-colors group">
                            {/* Image */}
                            <td className="px-4 py-3">
                              {item.image_url ? (
                                <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                  <Image
                                    src={item.image_url}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="36px"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-zinc-600" />
                                </div>
                              )}
                            </td>

                            {/* Name + description */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-white leading-tight">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{item.description}</p>
                              )}
                            </td>

                            {/* Price */}
                            <td className="px-4 py-3">
                              <PriceCell item={item} onSave={handlePriceSave} />
                            </td>

                            {/* Toggle */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <AvailabilityToggle item={item} onToggle={handleToggle} />
                                <span className={`text-xs font-medium ${item.is_available ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                  {item.is_available ? 'Live' : 'Hidden'}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                  title="Edit item"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(item)}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {(showAddModal || editingItem !== null) && (
        <ItemModal editingItem={editingItem} categories={categories} onClose={closeModal} onSave={handleSave} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
