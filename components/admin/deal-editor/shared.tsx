'use client'

// Deal types, defaults and the item/slot pickers shared by the Deals list and the deal editor pages.

import { useState } from 'react'

export type DealType = 'bogo' | 'bundle' | 'order_discount'

export interface Deal {
  id: string
  type: DealType
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-type deal JSON, validated by the API
  config: any
  is_active: boolean
  custom_label: string | null
  available_from: string | null
  available_until: string | null
  image_url: string | null
}

export interface Category { id: string; name: string; slug: string }

export interface MenuItemOption { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }

export interface Slot { label: string; min_qty: number; max_qty: number; item_ids: string[]; category?: string }

export const TYPE_LABELS: Record<DealType, string> = {
  bogo: 'BOGO',
  bundle: 'Build-a-Bundle',
  order_discount: 'Order/Category Discount',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-type deal JSON, validated by the API
export const EMPTY_CONFIG: Record<DealType, any> = {
  bogo: { buy: { item_ids: [], qty: 1 }, get: { item_ids: [], qty: 1, discount: 'free' } },
  bundle: { groups: [{ label: '', min_qty: 1, max_qty: 1, item_ids: [] }], price: 0, price_type: 'fixed' },
  order_discount: { scope: 'order', discount: { type: 'percent', value: 10 } },
}

// <input type="datetime-local"> only accepts "YYYY-MM-DDTHH:mm"; the DB column is
// TIMESTAMPTZ, so an unconverted ISO string with an offset renders as blank and the
// next save silently wipes the schedule.
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Legacy bundle groups are `{ label, category, pick_qty }`; reading them through this
// keeps the editor usable (rather than crashing on a missing item_ids) for any row the
// backfill migration has not reshaped yet.
export function normalizeSlot(g: Partial<Slot> & { pick_qty?: number }): Slot {
  return {
    label: g.label ?? '',
    min_qty: g.min_qty ?? g.pick_qty ?? 1,
    max_qty: g.max_qty ?? g.pick_qty ?? 1,
    item_ids: g.item_ids ?? [],
    ...(g.category ? { category: g.category } : {}),
  }
}

// Legacy BOGO deals store `{ category }` on buy/get; show those as the items currently in that
// category so the admin can edit them item-by-item. Saving writes item_ids and drops category.
export function bogoSideItemIds(side: { item_ids?: string[]; category?: string }, menuItems: MenuItemOption[]): string[] {
  if (side.item_ids?.length) return side.item_ids
  if (!side.category) return []
  const cat = side.category.trim().toLowerCase()
  return menuItems.filter((m) => m.category.trim().toLowerCase() === cat).map((m) => m.id)
}

// No upgrade items selected means no upgrades section: drop the key (and any stray label).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-type deal JSON, validated by the API
export function bundleConfigForSave(config: any) {
  const { upgrades, ...rest } = config
  const label = upgrades?.label?.trim()
  return {
    ...rest,
    price_type: config.price_type ?? 'fixed',
    ...(upgrades?.item_ids?.length ? { upgrades: { item_ids: upgrades.item_ids, ...(label ? { label } : {}) } } : {}),
  }
}

export function ItemPicker({ title, itemIds, menuItems, categories, onChange }: {
  title: string
  itemIds: string[]
  menuItems: MenuItemOption[]
  categories: Category[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = menuItems.filter((m) => {
    if (categoryFilter && m.category.toLowerCase() !== categoryFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const shownIds = filtered.map((m) => m.id)

  return (
    <div className="border border-zinc-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300">{title} ({itemIds.length} selected)</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => onChange([...new Set([...itemIds, ...shownIds])])} className="text-xs text-brand-red hover:underline">Select shown</button>
          <button type="button" onClick={() => onChange(itemIds.filter((id) => !shownIds.includes(id)))} className="text-xs text-zinc-400 hover:underline">Clear shown</button>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find item..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="max-h-48 overflow-y-auto border border-zinc-800 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {filtered.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm text-zinc-300 px-1 py-0.5 hover:bg-zinc-800 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={itemIds.includes(m.id)}
              onChange={() => onChange(itemIds.includes(m.id) ? itemIds.filter((x) => x !== m.id) : [...itemIds, m.id])}
            />
            {m.name}
          </label>
        ))}
      </div>
    </div>
  )
}

export function SlotEditor({ group, menuItems, categories, onChange, onRemove }: {
  group: Slot
  menuItems: MenuItemOption[]
  categories: Category[]
  onChange: (next: Slot) => void
  onRemove?: () => void
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = menuItems.filter((m) => {
    if (categoryFilter && m.category.toLowerCase() !== categoryFilter) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggleItem(id: string) {
    const next = group.item_ids.includes(id)
      ? group.item_ids.filter((x) => x !== id)
      : [...group.item_ids, id]
    onChange({ ...group, item_ids: next })
  }

  return (
    <div className="border border-zinc-800 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Slot Label</label>
          <input value={group.label} onChange={(e) => onChange({ ...group, label: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Min Qty</label>
          <input type="number" min={0} value={group.min_qty} onChange={(e) => onChange({ ...group, min_qty: parseInt(e.target.value) || 0 })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Max Qty</label>
          <input type="number" min={group.min_qty} value={group.max_qty} onChange={(e) => onChange({ ...group, max_qty: parseInt(e.target.value) || group.min_qty })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Include entire category (new products auto-appear)</label>
        <select
          value={group.category ?? ''}
          onChange={(e) => {
            const next = { ...group }
            if (e.target.value) next.category = e.target.value
            else delete next.category
            onChange(next)
          }}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">None — pick individual items</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        {group.category && (
          <p className="text-xs text-zinc-500 mt-1">
            All current and future items in {categories.find((c) => c.slug === group.category)?.name ?? group.category} are included.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">Items in This Slot ({group.item_ids.length} selected)</p>
        {onRemove && <button onClick={onRemove} className="text-xs text-red-400 hover:underline">Remove slot</button>}
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find item..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="max-h-40 overflow-y-auto border border-zinc-800 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {filtered.map((m) => {
          const viaCategory = Boolean(group.category) && m.category.toLowerCase() === group.category
          return (
            <label key={m.id} className={`flex items-center gap-2 text-sm text-zinc-300 px-1 py-0.5 hover:bg-zinc-800 rounded ${viaCategory ? 'opacity-60' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={viaCategory || group.item_ids.includes(m.id)} disabled={viaCategory} onChange={() => toggleItem(m.id)} />
              {m.name}
            </label>
          )
        })}
      </div>
    </div>
  )
}
