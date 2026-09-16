'use client'

import { useState, useEffect } from 'react'
import { Tag, Plus, X, Loader2, Check, Pencil, Trash2, Search, SlidersHorizontal } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { AdminDataTable, type Column } from '@/components/AdminDataTable'
import {
  buildPromoPayload, validatePromoPayload, usesDiscountValue, type DiscountType,
} from '@/lib/promo-form'

interface Promotion {
  id: string
  code: string | null
  promo_type: 'VOUCHER' | 'REWARD' | 'AUTO_APPLY'
  discount_type: DiscountType
  discount_value: number
  min_order_amount: number
  points_cost: number | null
  min_tier_id: string | null
  reward_config: { menu_item_id?: string } | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
}

interface Tier {
  id: string
  name: string
  sort_order: number
}

interface MenuItemOption {
  id: string
  name: string
  category: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type TypeFilter = 'ALL' | 'VOUCHER' | 'REWARD' | 'AUTO_APPLY'
type StatusFilter = 'ALL' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED'

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

function getPromoStatus(p: Promotion): 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' {
  const now = new Date()
  const end = p.end_date ? new Date(p.end_date) : null
  const start = p.start_date ? new Date(p.start_date) : null
  if (end && now > end) return 'EXPIRED'
  if (start && now < start) return 'SCHEDULED'
  return 'ACTIVE'
}

function PromoModal({ editing, tiers, menuItems, onClose, onSave }: {
  editing: Promotion | null
  tiers: Tier[]
  menuItems: MenuItemOption[]
  onClose: () => void
  onSave: (p: Promotion) => void
}) {
  const [code,     setCode]     = useState(editing?.code ?? '')
  const [promoType, setPromoType] = useState<'VOUCHER' | 'REWARD' | 'AUTO_APPLY'>(
    editing?.promo_type ?? 'VOUCHER'
  )
  const [pointsCost, setPointsCost] = useState(
    editing?.points_cost != null ? String(editing.points_cost) : ''
  )
  const [type,     setType]     = useState<DiscountType>(editing?.discount_type ?? 'flat')
  const [value,    setValue]    = useState(editing ? String(editing.discount_value) : '')
  const [minOrder, setMinOrder] = useState(editing ? String(editing.min_order_amount) : '0')
  const [minTierId, setMinTierId] = useState(editing?.min_tier_id ?? '')
  const [menuItemId, setMenuItemId] = useState(editing?.reward_config?.menu_item_id ?? '')
  const [startDate, setStartDate] = useState(
    editing?.start_date ? editing.start_date.slice(0, 16) : ''
  )
  const [endDate, setEndDate] = useState(
    editing?.end_date ? editing.end_date.slice(0, 16) : ''
  )
  const [itemSearch, setItemSearch] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const filteredItems = itemSearch
    ? menuItems.filter((m) => m.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : menuItems
  const selectedItem = menuItems.find((m) => m.id === menuItemId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = buildPromoPayload({
      promoType, code, discountType: type, value, minOrder,
      pointsCost, minTierId, menuItemId, startDate, endDate,
    })
    const validationError = validatePromoPayload(payload)
    if (validationError) return setError(validationError)

    setSaving(true)
    try {
      const url    = editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      onSave(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">{editing ? 'Edit Promotion' : 'Add Promotion'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['VOUCHER', 'REWARD', 'AUTO_APPLY'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPromoType(t)}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                    promoType === t
                      ? t === 'VOUCHER' ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                        : t === 'REWARD' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-white'
                  }`}
                >
                  {t === 'VOUCHER' ? '🏷 Voucher' : t === 'REWARD' ? '🎁 Reward' : '⚡ Flash'}
                </button>
              ))}
            </div>
          </div>

          {promoType === 'VOUCHER' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Promo Code <span className="text-red-400">*</span></label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. GRANDOPENING"
                className={`w-full uppercase tracking-wider font-mono ${inputCls}`} />
            </div>
          )}

          {promoType === 'REWARD' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Reward Name (internal ID)</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. FREE_DELIVERY"
                className={`w-full uppercase tracking-wider font-mono ${inputCls}`} />
              <p className="text-[11px] text-zinc-600 mt-1">Used as identifier — not shown to customers</p>
            </div>
          )}

          {promoType === 'AUTO_APPLY' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Flash Sale Name (optional)</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SUMMER_FLASH"
                className={`w-full uppercase tracking-wider font-mono ${inputCls}`} />
              <p className="text-[11px] text-zinc-600 mt-1">Auto-applied at checkout, no code needed</p>
            </div>
          )}

          {promoType === 'REWARD' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Points Cost <span className="text-red-400">*</span></label>
              <input type="number" step="100" min="100" value={pointsCost} onChange={(e) => setPointsCost(e.target.value)}
                placeholder="e.g. 500"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
              <p className="text-[11px] text-zinc-600 mt-1">Points customers spend to unlock this reward</p>
            </div>
          )}

          {promoType === 'REWARD' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Minimum Tier</label>
              <select value={minTierId} onChange={(e) => setMinTierId(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">No minimum — all tiers</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">Only customers at or above this tier can redeem</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Discount Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as DiscountType)} className={`w-full ${inputCls}`}>
              <option value="flat">Flat amount (£ off subtotal)</option>
              <option value="percentage">Percentage (% off subtotal)</option>
              <option value="free_delivery">Free delivery</option>
              <option value="free_item">Free item</option>
            </select>
          </div>

          {type === 'free_item' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Free Item <span className="text-red-400">*</span></label>
              <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Find item…"
                className={`w-full mb-2 ${inputCls}`} />
              <div className="max-h-40 overflow-y-auto border border-zinc-700 rounded-lg divide-y divide-zinc-800">
                {filteredItems.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMenuItemId(m.id)}
                    className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm transition-colors ${
                      menuItemId === m.id ? 'bg-brand-red/15 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}>
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-600 shrink-0">{m.category}</span>
                  </button>
                ))}
                {filteredItems.length === 0 && <p className="px-3 py-3 text-xs text-zinc-600">No items match.</p>}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1">
                {selectedItem ? `Selected: ${selectedItem.name}` : 'Pick the item this reward gives away'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {usesDiscountValue(type) && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Value ({type === 'flat' ? '£' : '%'})</label>
                <input type="number" step={type === 'flat' ? '0.01' : '1'} min="0" max={type === 'percentage' ? '100' : undefined}
                  value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'flat' ? '5.00' : '10'}
                  className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Order (£)</label>
              <input type="number" step="0.01" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00" className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Valid From</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Valid Until</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirm({ promo, onClose, onConfirm }: { promo: Promotion; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Delete &quot;{promo.code}&quot;?</h3>
        <p className="text-zinc-400 text-sm mb-5">This promotion will no longer work at checkout.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">Cancel</button>
          <button onClick={async () => { setBusy(true); await onConfirm(); setBusy(false) }} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const [promos, setPromos]             = useState<Promotion[]>([])
  const [tiers, setTiers]               = useState<Tier[]>([])
  const [menuItems, setMenuItems]       = useState<MenuItemOption[]>([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [toggleStates, setToggleStates] = useState<Record<string, SaveState>>({})

  // Filter state
  const [searchText, setSearchText]     = useState('')
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  async function fetchPromos() {
    setLoading(true)
    const r = await fetch('/api/admin/promotions')
    if (r.ok) setPromos(await r.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchPromos()
    fetch('/api/admin/loyalty/tiers').then((r) => r.ok ? r.json() : []).then(setTiers).catch(() => {})
    fetch('/api/admin/menu-items').then((r) => r.ok ? r.json() : []).then(setMenuItems).catch(() => {})
  }, [])

  const itemNames = Object.fromEntries(menuItems.map((m) => [m.id, m.name]))

  // Client-side filtering
  const filteredPromos = promos.filter((p) => {
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!(p.code ?? '').toLowerCase().includes(q)) return false
    }
    if (typeFilter !== 'ALL' && p.promo_type !== typeFilter) return false
    if (statusFilter !== 'ALL') {
      const dateStatus = getPromoStatus(p)
      if (statusFilter === 'ACTIVE' && !(dateStatus === 'ACTIVE' && p.is_active)) return false
      if (statusFilter === 'SCHEDULED' && dateStatus !== 'SCHEDULED') return false
      if (statusFilter === 'EXPIRED' && dateStatus !== 'EXPIRED') return false
    }
    return true
  })

  const hasActiveFilters = searchText !== '' || typeFilter !== 'ALL' || statusFilter !== 'ALL'

  function clearFilters() {
    setSearchText('')
    setTypeFilter('ALL')
    setStatusFilter('ALL')
  }

  function openAdd()              { setEditing(null); setShowModal(true) }
  function openEdit(p: Promotion) { setEditing(p); setShowModal(true) }
  function closeModal()           { setShowModal(false); setEditing(null) }

  function handleSave(promo: Promotion) {
    setPromos((prev) => prev.some((p) => p.id === promo.id)
      ? prev.map((p) => p.id === promo.id ? promo : p)
      : [promo, ...prev])
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/admin/promotions/${deleteTarget.id}`, { method: 'DELETE' })
    setPromos((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function handleToggle(promo: Promotion) {
    const next = !promo.is_active
    setPromos((prev) => prev.map((p) => p.id === promo.id ? { ...p, is_active: next } : p))
    setToggleStates((s) => ({ ...s, [promo.id]: 'saving' }))
    try {
      const res = await fetch(`/api/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setPromos((prev) => prev.map((p) => p.id === promo.id ? updated : p))
      setToggleStates((s) => ({ ...s, [promo.id]: 'saved' }))
      setTimeout(() => setToggleStates((s) => ({ ...s, [promo.id]: 'idle' })), 1200)
    } catch {
      setPromos((prev) => prev.map((p) => p.id === promo.id ? { ...p, is_active: !next } : p))
      setToggleStates((s) => ({ ...s, [promo.id]: 'error' }))
    }
  }

  const columns: Column<Promotion>[] = [
    {
      key: 'code',
      label: 'Code',
      render: (p) => p.code
        ? <span className="font-mono font-bold text-white text-base tracking-wider">{p.code}</span>
        : <span className="text-zinc-600 text-xs italic">auto</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (p) => {
        const cfg = {
          VOUCHER:    { label: '🏷 Voucher',  cls: 'bg-violet-500/15 text-violet-400' },
          REWARD:     { label: '🎁 Reward',   cls: 'bg-amber-500/15 text-amber-400' },
          AUTO_APPLY: { label: '⚡ Flash',    cls: 'bg-sky-500/15 text-sky-400' },
        }[p.promo_type] ?? { label: p.promo_type, cls: 'bg-zinc-700 text-zinc-400' }
        return (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (p) => {
        const cfg = {
          flat:          { badge: '£ flat',       cls: 'bg-emerald-500/15 text-emerald-400' },
          percentage:    { badge: '% off',        cls: 'bg-violet-500/15 text-violet-400'   },
          free_delivery: { badge: '🚚 delivery',  cls: 'bg-sky-500/15 text-sky-400'         },
          free_item:     { badge: '🎁 item',      cls: 'bg-amber-500/15 text-amber-400'     },
        }[p.discount_type]
        return (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.badge}</span>
            <span className="text-white font-semibold">
              {p.discount_type === 'flat'          ? `£${Number(p.discount_value).toFixed(2)}`
                : p.discount_type === 'percentage' ? `${Number(p.discount_value)}%`
                : p.discount_type === 'free_delivery' ? 'Free delivery'
                : itemNames[p.reward_config?.menu_item_id ?? ''] ?? 'Free item'}
            </span>
          </div>
        )
      },
    },
    {
      key: 'min',
      label: 'Min Order',
      render: (p) => Number(p.min_order_amount) > 0
        ? <span className="text-zinc-400">£{Number(p.min_order_amount).toFixed(2)}</span>
        : <span className="text-zinc-600">None</span>,
    },
    {
      key: 'validity',
      label: 'Validity',
      render: (p) => {
        const now = new Date()
        const start = p.start_date ? new Date(p.start_date) : null
        const end   = p.end_date   ? new Date(p.end_date)   : null
        const expired = end && now > end
        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

        if (!start && !end) return <span className="text-zinc-600">Always</span>

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-400 text-xs">
              {start ? fmt(start) : '∞'} — {end ? fmt(end) : '∞'}
            </span>
            {expired && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-wide">
                Expired
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'active',
      label: 'Active',
      render: (p) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleToggle(p)} role="switch" aria-checked={p.is_active}
            disabled={toggleStates[p.id] === 'saving'}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${p.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
            <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${p.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          {toggleStates[p.id] === 'saving' && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
          {toggleStates[p.id] === 'saved'  && <Check className="w-3 h-3 text-emerald-400" />}
          <span className={`text-xs font-medium ${p.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {p.is_active ? 'Active' : 'Off'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(p)}
            className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeleteTarget(p)}
            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  const headerSubtitle = loading
    ? 'Loading…'
    : hasActiveFilters
      ? `${filteredPromos.length} of ${promos.length} promotion${promos.length !== 1 ? 's' : ''} · ${promos.filter((p) => p.is_active).length} active`
      : `${promos.length} promotion${promos.length !== 1 ? 's' : ''} · ${promos.filter((p) => p.is_active).length} active`

  const emptyNode = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="opacity-30">
        <Tag className="w-12 h-12 text-zinc-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm text-zinc-400">
          {hasActiveFilters ? 'No promotions found matching your current filters' : 'No promotions yet'}
        </p>
        {hasActiveFilters && (
          <p className="text-xs text-zinc-600">Try adjusting or clearing your search criteria</p>
        )}
      </div>
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Reset Search Criteria
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Promotions</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{headerSubtitle}</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30">
            <Plus className="w-4 h-4" /> Add Promotion
          </button>
        </header>

        <div className="flex-1 px-8 py-6 overflow-auto space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-zinc-500">
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
            </div>

            {/* Text Search */}
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by code or name…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className={`min-w-[150px] ${inputCls}`}
            >
              <option value="ALL">All Types</option>
              <option value="VOUCHER">🏷 Vouchers</option>
              <option value="REWARD">🎁 Points Rewards</option>
              <option value="AUTO_APPLY">⚡ Flash Sales</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={`min-w-[150px] ${inputCls}`}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Now</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="EXPIRED">Expired</option>
            </select>

            {/* Clear Filters — visible only when any filter active */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>

          <AdminDataTable
            columns={columns}
            data={filteredPromos}
            loading={loading}
            hideSearch
            emptyNode={emptyNode}
            keyExtractor={(p) => p.id}
          />
        </div>
      </main>

      {showModal && (
        <PromoModal editing={editing} tiers={tiers} menuItems={menuItems} onClose={closeModal} onSave={handleSave} />
      )}
      {deleteTarget && (
        <DeleteConfirm promo={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
