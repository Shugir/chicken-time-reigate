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
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Extra {
  name: string
  price: number
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string
  is_available: boolean
  extras: Extra[]
  removals: string[]
  created_at: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface DbCategory { id: string; name: string; slug: string; sort_order: number; is_active: boolean }

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
      {saveState === 'saved'  && <Check className="w-3.5 h-3.5 text-emerald-400" />}
      {saveState === 'error'  && <X    className="w-3.5 h-3.5 text-red-400" />}
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

// ─── Tag Autocomplete ─────────────────────────────────────────────────────────

const TAG_INPUT_CLS = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

function TagAutocomplete({ tags, onChange, suggestions, placeholder }: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  placeholder?: string
}) {
  const [input, setInput]       = useState('')
  const [open, setOpen]         = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const [rect, setRect]         = useState<DOMRect | null>(null)

  const filtered = suggestions.filter(
    (s) => (!input.trim() || s.toLowerCase().includes(input.toLowerCase())) && !tags.includes(s),
  )

  useEffect(() => {
    if (open && containerRef.current) setRect(containerRef.current.getBoundingClientRect())
  }, [open, input, tags])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function addTag(value: string) {
    const val = value.trim()
    if (!val || tags.includes(val)) return
    onChange([...tags, val])
    setInput('')
    setActiveIdx(-1)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      activeIdx >= 0 && filtered[activeIdx] ? addTag(filtered[activeIdx]) : addTag(input)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
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
              onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
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
    <div ref={containerRef}>
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 focus-within:ring-1 focus-within:ring-brand-red focus-within:border-brand-red cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 bg-zinc-700 text-zinc-200 text-xs px-2 py-0.5 rounded-full shrink-0">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-zinc-500 hover:text-white ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); setActiveIdx(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none py-0.5"
        />
      </div>
      {dropdown}
    </div>
  )
}

// ─── Extra Name Input (autocomplete for extras name field) ────────────────────

function ExtraNameInput({ value, onChange, onEnter, suggestions, placeholder }: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  suggestions: string[]
  placeholder?: string
}) {
  const [open, setOpen]         = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef            = useRef<HTMLDivElement>(null)
  const [rect, setRect]         = useState<DOMRect | null>(null)

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

// ─── Item Modal (add + edit) ──────────────────────────────────────────────────

interface ItemModalProps {
  editingItem: MenuItem | null
  categories:  DbCategory[]
  onClose: () => void
  onSave: (item: MenuItem) => void
}

const EMPTY_FORM = { name: '', description: '', price: '', image_url: '', category: '' }

function ItemModal({ editingItem, categories, onClose, onSave }: ItemModalProps) {
  const [form, setForm] = useState(() =>
    editingItem
      ? {
          name:        editingItem.name,
          description: editingItem.description ?? '',
          price:       editingItem.price.toFixed(2),
          image_url:   editingItem.image_url ?? '',
          category:    editingItem.category,
        }
      : { ...EMPTY_FORM, category: categories[0]?.slug ?? '' }
  )
  const [removals, setRemovals]         = useState<string[]>(() => editingItem?.removals ?? [])
  const [extras, setExtras]             = useState<Extra[]>(() => editingItem?.extras ?? [])
  const [extraInput, setExtraInput]     = useState({ name: '', price: '' })
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [suggestions, setSuggestions]   = useState<{ removals: string[]; extras: string[] }>({ removals: [], extras: [] })

  useEffect(() => {
    fetch('/api/admin/menu/suggestions')
      .then((r) => r.json())
      .then((d) => setSuggestions(d))
      .catch(() => {})
  }, [])

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  function addExtra() {
    const name = extraInput.name.trim()
    const price = parseFloat(extraInput.price)
    if (!name || isNaN(price) || price < 0) return
    if (extras.some((e) => e.name === name)) return
    setExtras((prev) => [...prev, { name, price }])
    setExtraInput({ name: '', price: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = parseFloat(form.price)
    if (!form.name.trim()) return setError('Name is required.')
    if (isNaN(parsed) || parsed <= 0) return setError('Enter a valid price.')
    if (!form.category) return setError('Category is required.')

    const payload = {
      name:         form.name.trim(),
      description:  form.description.trim() || null,
      price:        parsed,
      image_url:    form.image_url.trim() || null,
      category:     form.category,
      is_available: editingItem ? editingItem.is_available : true,
      removals,
      extras,
    }

    setSaving(true)
    try {
      const url    = editingItem ? `/api/admin/menu-items/${editingItem.id}` : '/api/admin/menu-items'
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

  const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-white">{editingItem ? 'Edit Item' : 'Add New Menu Item'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input {...field('name')} placeholder="e.g. Spicy Chicken Burger" className={`w-full ${inputCls}`} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
            <textarea
              {...field('description')}
              rows={2}
              placeholder="Short description of the item"
              className={`w-full resize-none ${inputCls}`}
            />
          </div>

          {/* Price + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Price (£) <span className="text-red-400">*</span></label>
              <input
                {...field('price')}
                type="number" step="0.01" min="0" placeholder="0.00"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category <span className="text-red-400">*</span></label>
              <div className="relative">
                <select {...field('category')} className={`w-full appearance-none pr-8 ${inputCls}`}>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Image URL</label>
            <input {...field('image_url')} type="url" placeholder="https://images.unsplash.com/..." className={`w-full ${inputCls}`} />
          </div>

          {/* ── Removable Ingredients ── */}
          <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-300">Removable Ingredients</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Click a suggestion or type your own, then press Enter</p>
            </div>
            <TagAutocomplete
              tags={removals}
              onChange={setRemovals}
              suggestions={suggestions.removals}
              placeholder="e.g. Pickles, Onions…"
            />
          </div>

          {/* ── Priced Extras ── */}
          <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-300">Priced Extras</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Add-ons customers can choose for an extra charge</p>
            </div>
            <div className="flex gap-2">
              <ExtraNameInput
                value={extraInput.name}
                onChange={(v) => setExtraInput((x) => ({ ...x, name: v }))}
                onEnter={addExtra}
                suggestions={suggestions.extras}
                placeholder="e.g. Bacon"
              />
              <div className="relative w-24">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraInput.price}
                  onChange={(e) => setExtraInput((x) => ({ ...x, price: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra() } }}
                  placeholder="0.00"
                  className={`w-full pl-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
                />
              </div>
              <button
                type="button"
                onClick={addExtra}
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {extras.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {extras.map((ex) => (
                  <span key={ex.name} className="flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-full">
                    {ex.name}
                    <span className="text-brand-red font-semibold ml-0.5">+£{ex.price.toFixed(2)}</span>
                    <button type="button" onClick={() => setExtras((prev) => prev.filter((x) => x.name !== ex.name))} className="text-zinc-500 hover:text-white ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-semibold
                         hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingItem ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? (editingItem ? 'Saving…' : 'Adding…') : editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
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


export default function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<DbCategory[]>([])

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {})
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

  // Group by category
  const grouped = categories.map((cat, idx) => ({
    cat,
    idx,
    rows: items.filter((i) => i.category.toLowerCase() === cat.slug),
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
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
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
        </header>

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
                  <div className="rounded-xl border border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-12">Image</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-36">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-28">Available</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {rows.map((item) => (
                          <tr key={item.id} className="bg-zinc-950/50 hover:bg-zinc-800/30 transition-colors group">
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
