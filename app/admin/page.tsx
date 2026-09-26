'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
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
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import DeleteConfirmModal from '@/components/admin/menu-item-editor/DeleteConfirmModal'
import type { DbCategory, MenuItem } from '@/components/admin/menu-item-editor/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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

// ─── Main Page ────────────────────────────────────────────────────────────────


interface QuickStats { revenue_today: number; orders_today: number; active_promotions: number }

export default function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [stats, setStats] = useState<QuickStats | null>(null)

  // The item editor pages come back here with ?saved=<name>: confirm it, then drop the query
  useEffect(() => {
    const saved = new URLSearchParams(window.location.search).get('saved')
    if (saved === null) return
    toast.success(`Saved ${saved}`)
    window.history.replaceState(null, '', '/admin')
  }, [])

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
            <Link
              href="/admin/menu/new"
              className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add New Item
            </Link>
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
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <Link href={`/admin/menu/${item.id}`} aria-label={`Edit ${item.name}`} className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-blue-400 backdrop-blur-sm" title="Edit">
                              <Pencil className="w-3 h-3" />
                            </Link>
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
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <Link
                                  href={`/admin/menu/${item.id}`}
                                  aria-label={`Edit ${item.name}`}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                  title="Edit item"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Link>
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
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
