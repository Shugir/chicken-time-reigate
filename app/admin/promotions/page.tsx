'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, UtensilsCrossed, Settings, MapPin, Tag,
  Plus, X, Loader2, Check, Pencil, Trash2, ExternalLink,
} from 'lucide-react'
import SignOutButton from '@/components/admin/sign-out-button'

interface Promotion {
  id: string
  code: string
  discount_type: 'flat' | 'percentage'
  discount_value: number
  min_order_amount: number
  is_active: boolean
  created_at: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: <LayoutDashboard className="w-4 h-4" />, href: '/admin/dashboard' },
  { id: 'menu',       label: 'Menu Manager',   icon: <UtensilsCrossed className="w-4 h-4" />, href: '/admin' },
  { id: 'settings',   label: 'Store Settings', icon: <Settings className="w-4 h-4" />,        href: '/admin/settings' },
  { id: 'delivery',   label: 'Delivery Zones', icon: <MapPin className="w-4 h-4" />,           href: '/admin/delivery' },
  { id: 'promotions', label: 'Promotions',     icon: <Tag className="w-4 h-4" />,              href: '/admin/promotions' },
]

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

// ─── Promotion Modal ──────────────────────────────────────────────────────────

function PromoModal({ editing, onClose, onSave }: {
  editing: Promotion | null
  onClose: () => void
  onSave: (p: Promotion) => void
}) {
  const [code,     setCode]     = useState(editing?.code ?? '')
  const [type,     setType]     = useState<'flat' | 'percentage'>(editing?.discount_type ?? 'flat')
  const [value,    setValue]    = useState(editing ? String(editing.discount_value) : '')
  const [minOrder, setMinOrder] = useState(editing ? String(editing.min_order_amount) : '0')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!code.trim()) return setError('Code is required.')
    const val = parseFloat(value)
    if (isNaN(val) || val <= 0) return setError('Discount value must be positive.')
    if (type === 'percentage' && val > 100) return setError('Percentage cannot exceed 100.')
    const minNum = parseFloat(minOrder)
    if (isNaN(minNum) || minNum < 0) return setError('Invalid minimum order amount.')

    const payload = {
      code:             code.trim().toUpperCase(),
      discount_type:    type,
      discount_value:   val,
      min_order_amount: minNum,
    }

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
          <h2 className="text-base font-semibold text-white">
            {editing ? 'Edit Promotion' : 'Add Promotion'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Promo Code <span className="text-red-400">*</span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. GRANDOPENING"
              className={`w-full uppercase tracking-wider font-mono ${inputCls}`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Discount Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'flat' | 'percentage')}
              className={`w-full ${inputCls}`}
            >
              <option value="flat">Flat amount (£ off subtotal)</option>
              <option value="percentage">Percentage (% off subtotal)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Value ({type === 'flat' ? '£' : '%'})
              </label>
              <input
                type="number"
                step={type === 'flat' ? '0.01' : '1'}
                min="0"
                max={type === 'percentage' ? '100' : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'flat' ? '5.00' : '10'}
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Order (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : editing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ promo, onClose, onConfirm }: {
  promo: Promotion; onClose: () => void; onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Delete &quot;{promo.code}&quot;?</h3>
        <p className="text-zinc-400 text-sm mb-5">
          This promotion will no longer work at checkout.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false) }}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const [promos, setPromos]               = useState<Promotion[]>([])
  const [loading, setLoading]             = useState(true)
  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Promotion | null>(null)
  const [toggleStates, setToggleStates]   = useState<Record<string, SaveState>>({})

  useEffect(() => {
    fetch('/api/admin/promotions')
      .then((r) => r.json())
      .then((data) => { setPromos(data); setLoading(false) })
  }, [])

  function openAdd()              { setEditing(null); setShowModal(true) }
  function openEdit(p: Promotion) { setEditing(p); setShowModal(true) }
  function closeModal()           { setShowModal(false); setEditing(null) }

  function handleSave(promo: Promotion) {
    setPromos((prev) =>
      prev.some((p) => p.id === promo.id)
        ? prev.map((p) => p.id === promo.id ? promo : p)
        : [promo, ...prev],
    )
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍗</span>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Chicken Time</p>
              <p className="text-[10px] text-zinc-500 leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link key={item.id} href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${item.href === '/admin/promotions'
                  ? 'bg-brand-red/15 text-white ring-1 ring-brand-red/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pt-2 pb-1 border-t border-zinc-800">
          <a
            href="/kitchen"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <UtensilsCrossed className="w-4 h-4" />
            Kitchen Display
            <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
          </a>
        </div>
        <div className="px-4 py-4 border-t border-zinc-800 space-y-2">
          <SignOutButton />
          <p className="text-[11px] text-zinc-600 px-3">v1.0 · Reigate</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Promotions</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading
                ? 'Loading…'
                : `${promos.length} code${promos.length !== 1 ? 's' : ''} · ${promos.filter((p) => p.is_active).length} active`}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30">
            <Plus className="w-4 h-4" /> Add Promotion
          </button>
        </header>

        <div className="flex-1 px-8 py-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Tag className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-medium">No promotions yet</p>
              <p className="text-zinc-600 text-sm mt-1">Click &quot;Add Promotion&quot; to create your first discount code.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Code</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Discount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Min Order</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-28">Active</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {promos.map((promo) => (
                    <tr key={promo.id} className="bg-zinc-950/50 hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-white text-base tracking-wider">{promo.code}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            promo.discount_type === 'flat'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-violet-500/15 text-violet-400'
                          }`}>
                            {promo.discount_type === 'flat' ? '£ flat' : '% off'}
                          </span>
                          <span className="text-white font-semibold">
                            {promo.discount_type === 'flat'
                              ? `£${Number(promo.discount_value).toFixed(2)}`
                              : `${Number(promo.discount_value)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {Number(promo.min_order_amount) > 0
                          ? `£${Number(promo.min_order_amount).toFixed(2)}`
                          : <span className="text-zinc-600">None</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(promo)}
                            role="switch"
                            aria-checked={promo.is_active}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors
                              focus:outline-none
                              ${promo.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
                              ${promo.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          {toggleStates[promo.id] === 'saving' && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
                          {toggleStates[promo.id] === 'saved'  && <Check className="w-3 h-3 text-emerald-400" />}
                          <span className={`text-xs font-medium ${promo.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {promo.is_active ? 'Active' : 'Off'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(promo)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(promo)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && <PromoModal editing={editing} onClose={closeModal} onSave={handleSave} />}
      {deleteTarget && (
        <DeleteConfirm promo={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
