'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { inSlot } from '@/lib/deal-engine'

type DealType = 'bogo' | 'bundle' | 'order_discount'

interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  is_active: boolean
  custom_label: string | null
  available_from: string | null
  available_until: string | null
  image_url: string | null
}

interface Category { id: string; name: string; slug: string }

interface MenuItemOption { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }

interface Slot { label: string; min_qty: number; max_qty: number; item_ids: string[]; category?: string }

const TYPE_LABELS: Record<DealType, string> = {
  bogo: 'BOGO',
  bundle: 'Build-a-Bundle',
  order_discount: 'Order/Category Discount',
}

const EMPTY_CONFIG: Record<DealType, any> = {
  bogo: { buy: { item_ids: [], qty: 1 }, get: { item_ids: [], qty: 1, discount: 'free' } },
  bundle: { groups: [{ label: '', min_qty: 1, max_qty: 1, item_ids: [] }], price: 0, price_type: 'fixed' },
  order_discount: { scope: 'order', discount: { type: 'percent', value: 10 } },
}

// <input type="datetime-local"> only accepts "YYYY-MM-DDTHH:mm"; the DB column is
// TIMESTAMPTZ, so an unconverted ISO string with an offset renders as blank and the
// next save silently wipes the schedule.
function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function DealsAdminPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [creatingType, setCreatingType] = useState<DealType | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/deals').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/admin/menu-items').then((r) => r.json()),
    ])
      .then(([d, c, m]) => { setDeals(d); setCategories(c); setMenuItems(m) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Refetch when the deal modal opens so products/categories added since page load appear.
  const formType = editing?.type ?? creatingType
  useEffect(() => {
    if (!formType) return
    fetch('/api/admin/menu-items').then((r) => r.json()).then((m) => { if (Array.isArray(m)) setMenuItems(m) }).catch(() => {})
    fetch('/api/categories').then((r) => r.json()).then((c) => { if (Array.isArray(c)) setCategories(c) }).catch(() => {})
  }, [formType])

  async function handleToggle(id: string, is_active: boolean) {
    const res = await fetch(`/api/admin/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (res.ok) setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, is_active } : d)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE' })
    if (res.ok) setDeals((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleSave(payload: { type: DealType; name: string; config: any; custom_label: string | null; available_from: string | null; available_until: string | null; image_url: string | null }) {
    setError(null)
    const isEdit = Boolean(editing)
    const url = isEdit ? `/api/admin/deals/${editing!.id}` : '/api/admin/deals'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Save failed'); return }
    setEditing(null)
    setCreatingType(null)
    load()
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Deals</h1>
              <p className="text-zinc-400 text-sm">BOGO, bundles and order-wide discounts — auto-applied at checkout.</p>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-red/80 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                <Plus className="w-4 h-4" /> New Deal
              </button>
              <div className="absolute right-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl hidden group-hover:block z-10">
                {(Object.keys(TYPE_LABELS) as DealType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCreatingType(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 first:rounded-t-xl last:rounded-b-xl"
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-zinc-500 text-sm">Loading...</div>
          ) : deals.length === 0 ? (
            <div className="text-zinc-500 text-sm">No deals yet — create one above.</div>
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-red px-2 py-0.5 bg-brand-red/10 rounded">
                        {TYPE_LABELS[deal.type]}
                      </span>
                      {!deal.is_active && <span className="text-xs text-zinc-600">inactive</span>}
                    </div>
                    <p className="text-white font-medium text-sm">{deal.name}</p>
                  </div>
                  <button onClick={() => setEditing(deal)} className="text-zinc-500 hover:text-white p-2">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(deal.id)} className="text-zinc-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(deal.id, !deal.is_active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${deal.is_active ? 'bg-brand-red' : 'bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${deal.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {formType && (
        <DealFormModal
          type={formType}
          categories={categories}
          menuItems={menuItems}
          initial={editing ?? { type: formType, name: '', config: EMPTY_CONFIG[formType], is_active: true, custom_label: null, available_from: null, available_until: null, image_url: null } as any}
          error={error}
          onCancel={() => { setEditing(null); setCreatingType(null); setError(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// Legacy bundle groups are `{ label, category, pick_qty }`; reading them through this
// keeps the editor usable (rather than crashing on a missing item_ids) for any row the
// backfill migration has not reshaped yet.
function normalizeSlot(g: Partial<Slot> & { pick_qty?: number }): Slot {
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
function bogoSideItemIds(side: { item_ids?: string[]; category?: string }, menuItems: MenuItemOption[]): string[] {
  if (side.item_ids?.length) return side.item_ids
  if (!side.category) return []
  const cat = side.category.trim().toLowerCase()
  return menuItems.filter((m) => m.category.trim().toLowerCase() === cat).map((m) => m.id)
}

// No upgrade items selected means no upgrades section: drop the key (and any stray label).
function bundleConfigForSave(config: any) {
  const { upgrades, ...rest } = config
  const label = upgrades?.label?.trim()
  return {
    ...rest,
    price_type: config.price_type ?? 'fixed',
    ...(upgrades?.item_ids?.length ? { upgrades: { item_ids: upgrades.item_ids, ...(label ? { label } : {}) } } : {}),
  }
}

function ItemPicker({ title, itemIds, menuItems, categories, onChange }: {
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

function SlotEditor({ group, menuItems, categories, onChange, onRemove }: {
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

function DealFormModal({ type, categories, menuItems, initial, error, onCancel, onSave }: {
  type: DealType
  categories: Category[]
  menuItems: MenuItemOption[]
  initial: Deal
  error: string | null
  onCancel: () => void
  onSave: (payload: { type: DealType; name: string; config: any; custom_label: string | null; available_from: string | null; available_until: string | null; image_url: string | null }) => void
}) {
  const [name, setName] = useState(initial.name)
  const [config, setConfig] = useState<any>(initial.config)
  const [customLabel, setCustomLabel] = useState(initial.custom_label ?? '')
  const [availableFrom, setAvailableFrom] = useState(toDateTimeLocal(initial.available_from))
  const [availableUntil, setAvailableUntil] = useState(toDateTimeLocal(initial.available_until))
  const existingImageUrl = initial.image_url ?? ''
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function set(path: (string | number)[], value: any) {
    setConfig((prev: any) => {
      const next = structuredClone(prev)
      let cur = next
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]]
      cur[path[path.length - 1]] = value
      return next
    })
  }

  // Writing item_ids also drops any legacy `category` so the deal becomes purely item-based.
  function setBogoItems(side: 'buy' | 'get', ids: string[]) {
    setConfig((prev: any) => {
      const next = structuredClone(prev)
      next[side].item_ids = ids
      delete next[side].category
      return next
    })
  }

  const bogoMissingItems = type === 'bogo' && (
    bogoSideItemIds(config.buy, menuItems).length === 0 || bogoSideItemIds(config.get, menuItems).length === 0
  )

  const upgradeIds: string[] = type === 'bundle' ? config.upgrades?.item_ids ?? [] : []
  const upgradesInSlots = menuItems.filter((m) =>
    upgradeIds.includes(m.id) && (config.groups ?? []).some((g: Slot) => inSlot({ item_ids: g.item_ids ?? [], category: g.category }, m)),
  )

  const categoryOptions = (
    <>
      <option value="">— choose category —</option>
      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-6">
      <div role="dialog" aria-modal="true" className="flex flex-col w-full sm:max-w-xl max-h-[92dvh] sm:max-h-[85vh] bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-white">{TYPE_LABELS[type]}</h2>
          <button onClick={onCancel} aria-label="Close" className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Deal name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="e.g. Buy 1 Get 1 Free Wings"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Custom Label (optional — overrides the auto-generated badge text)</label>
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Leave blank to use the default label"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          {type === 'bundle' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Bundle price</label>
              <select
                value={config.price_type ?? 'fixed'}
                onChange={(e) => {
                  set(['price_type'], e.target.value)
                  if (e.target.value === 'percent') set(['price'], 0)
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
              >
                <option value="fixed">Fixed price (£)</option>
                <option value="percent">Percentage off</option>
              </select>
              {(config.price_type ?? 'fixed') === 'percent' ? (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Discount %</label>
                  <input type="number" min={1} max={100} value={config.discount_percent ?? ''} onChange={(e) => set(['discount_percent'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Bundle price (£)</label>
                  <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Available From (optional)</label>
              <input
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Available Until (optional)</label>
              <input
                type="datetime-local"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {type === 'bogo' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Discount</label>
              <select
                value={config.get.discount === 'free' ? 'free' : 'percent'}
                onChange={(e) => set(['get', 'discount'], e.target.value === 'free' ? 'free' : { percent: 50 })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="free">Free</option>
                <option value="percent">Percent off</option>
              </select>
              {config.get.discount !== 'free' && (
                <input
                  type="number" min={1} max={100}
                  value={config.get.discount.percent}
                  onChange={(e) => set(['get', 'discount'], { percent: parseInt(e.target.value) || 0 })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mt-2"
                />
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Deal Image (optional)</label>
            {existingImageUrl && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 mb-2">
                <Image src={existingImageUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={imageUploading}
              onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setUploadError(null) }}
              className="text-sm text-zinc-400"
            />
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>

          {type === 'bogo' && (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Buy qty</label>
                <input type="number" min={1} value={config.buy.qty} onChange={(e) => set(['buy', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <ItemPicker
                title="Buy items"
                itemIds={bogoSideItemIds(config.buy, menuItems)}
                menuItems={menuItems}
                categories={categories}
                onChange={(ids) => setBogoItems('buy', ids)}
              />
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Get qty</label>
                <input type="number" min={1} value={config.get.qty} onChange={(e) => set(['get', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <ItemPicker
                title="Get items"
                itemIds={bogoSideItemIds(config.get, menuItems)}
                menuItems={menuItems}
                categories={categories}
                onChange={(ids) => setBogoItems('get', ids)}
              />
            </>
          )}

          {type === 'bundle' && (
            <>
              {config.groups.map((g: any, i: number) => (
                <SlotEditor
                  key={i}
                  group={normalizeSlot(g)}
                  menuItems={menuItems}
                  categories={categories}
                  onChange={(next) => set(['groups', i], next)}
                  onRemove={config.groups.length > 1 ? () => set(['groups'], config.groups.filter((_: any, gi: number) => gi !== i)) : undefined}
                />
              ))}
              <button
                onClick={() => set(['groups'], [...config.groups, { label: '', min_qty: 1, max_qty: 1, item_ids: [] }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add slot
              </button>

              <div className="border-t border-zinc-800 pt-4 space-y-2">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Upgrades (optional paid add-ons shown in the bundle popup)</label>
                  <input
                    value={config.upgrades?.label ?? ''}
                    onChange={(e) => set(['upgrades'], { ...config.upgrades, item_ids: config.upgrades?.item_ids ?? [], label: e.target.value })}
                    placeholder="Upgrade your deal"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <ItemPicker
                  title="Upgrade items"
                  itemIds={upgradeIds}
                  menuItems={menuItems}
                  categories={categories}
                  onChange={(ids) => set(['upgrades'], { ...config.upgrades, item_ids: ids })}
                />
                {upgradesInSlots.length > 0 && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/60 rounded-lg px-3 py-2">
                    {upgradesInSlots.map((m) => m.name).join(', ')} also sit in a slot, so the deal may count them as bundle items.
                  </p>
                )}
              </div>
            </>
          )}

          {type === 'order_discount' && (
            <>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Scope</label>
                <select value={config.scope} onChange={(e) => set(['scope'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="order">Whole order</option>
                  <option value="category">Specific category</option>
                </select>
              </div>
              {config.scope === 'category' && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                  <select value={config.category ?? ''} onChange={(e) => set(['category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Minimum subtotal (£, optional)</label>
                <input type="number" min={0} step="0.01" value={config.min_subtotal ?? ''} onChange={(e) => set(['min_subtotal'], e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Discount type</label>
                  <select value={config.discount.type} onChange={(e) => set(['discount', 'type'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="percent">Percent</option>
                    <option value="amount">Amount (£)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Value</label>
                  <input type="number" min={0} step="0.01" value={config.discount.value} onChange={(e) => set(['discount', 'value'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

        <div className="flex gap-3 px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-zinc-800 shrink-0">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm text-zinc-300 hover:text-white border border-zinc-700 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => {
              let resolvedImageUrl = existingImageUrl.trim() || null
              if (imageFile) {
                setImageUploading(true)
                setUploadError(null)
                const fd = new FormData()
                fd.append('file', imageFile)
                const res = await fetch('/api/admin/menu/upload', { method: 'POST', body: fd })
                const data = await res.json()
                setImageUploading(false)
                if (!res.ok) return setUploadError(`Image upload failed: ${data.error ?? 'Unknown error'}`)
                resolvedImageUrl = data.url
              }
              onSave({
                type, name,
                config: type === 'bundle' ? bundleConfigForSave(config) : config,
                custom_label: customLabel.trim() || null,
                available_from: fromDateTimeLocal(availableFrom),
                available_until: fromDateTimeLocal(availableUntil),
                image_url: resolvedImageUrl,
              })
            }}
            disabled={!name.trim() || imageUploading || bogoMissingItems}
            title={bogoMissingItems ? 'Select at least one buy item and one get item' : undefined}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-brand-red hover:bg-brand-red/80 text-white disabled:opacity-50 transition-colors"
          >
            {imageUploading ? 'Uploading...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
