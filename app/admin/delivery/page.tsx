'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UtensilsCrossed, Settings, MapPin,
  Plus, X, Loader2, Check, Pencil, Trash2, ChevronDown,
} from 'lucide-react'

interface DeliveryZone {
  id: string
  postcode_prefix: string
  delivery_fee: number
  min_order_amount: number
  is_active: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const NAV = [
  { id: 'menu',     label: 'Menu Manager',   icon: <UtensilsCrossed className="w-4 h-4" />, href: '/admin' },
  { id: 'settings', label: 'Store Settings', icon: <Settings className="w-4 h-4" />,        href: '/admin/settings' },
  { id: 'delivery', label: 'Delivery Zones', icon: <MapPin className="w-4 h-4" />,          href: '/admin/delivery' },
]

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

// ─── Zone Modal ───────────────────────────────────────────────────────────────

function ZoneModal({
  editingZone, onClose, onSave,
}: {
  editingZone: DeliveryZone | null
  onClose: () => void
  onSave: (zone: DeliveryZone) => void
}) {
  const [prefix, setPrefix]   = useState(editingZone?.postcode_prefix ?? '')
  const [fee, setFee]         = useState(editingZone ? String(editingZone.delivery_fee) : '1.99')
  const [minOrder, setMinOrder] = useState(editingZone ? String(editingZone.min_order_amount) : '0')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!prefix.trim()) return setError('Postcode prefix is required.')
    const feeNum = parseFloat(fee)
    const minNum = parseFloat(minOrder)
    if (isNaN(feeNum) || feeNum < 0) return setError('Invalid delivery fee.')
    if (isNaN(minNum) || minNum < 0) return setError('Invalid minimum order.')

    const payload = {
      postcode_prefix: prefix.trim().toUpperCase(),
      delivery_fee: feeNum,
      min_order_amount: minNum,
    }

    setSaving(true)
    try {
      const url    = editingZone ? `/api/admin/delivery-zones/${editingZone.id}` : '/api/admin/delivery-zones'
      const method = editingZone ? 'PATCH' : 'POST'
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
          <h2 className="text-base font-semibold text-white">{editingZone ? 'Edit Zone' : 'Add Delivery Zone'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Postcode Prefix <span className="text-red-400">*</span>
            </label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. RH2"
              className={`w-full uppercase ${inputCls}`}
            />
            <p className="text-[11px] text-zinc-600 mt-1">Matches any postcode starting with this prefix</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Delivery Fee (£)</label>
              <input
                type="number" step="0.01" min="0" value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="1.99"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Order (£)</label>
              <input
                type="number" step="0.01" min="0" value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00"
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingZone ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving…' : editingZone ? 'Save Changes' : 'Add Zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ zone, onClose, onConfirm }: {
  zone: DeliveryZone; onClose: () => void; onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Delete "{zone.postcode_prefix}"?</h3>
        <p className="text-zinc-400 text-sm mb-5">Customers in this area will no longer be able to order.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
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

export default function DeliveryPage() {
  const [zones, setZones]             = useState<DeliveryZone[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null)
  const [toggleStates, setToggleStates] = useState<Record<string, SaveState>>({})

  useEffect(() => {
    fetch('/api/admin/delivery-zones')
      .then((r) => r.json())
      .then((data) => { setZones(data); setLoading(false) })
  }, [])

  function openAdd()              { setEditingZone(null); setShowModal(true) }
  function openEdit(z: DeliveryZone) { setEditingZone(z); setShowModal(true) }
  function closeModal()           { setShowModal(false); setEditingZone(null) }

  function handleSave(zone: DeliveryZone) {
    setZones((prev) =>
      prev.some((z) => z.id === zone.id) ? prev.map((z) => z.id === zone.id ? zone : z) : [...prev, zone]
    )
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/admin/delivery-zones/${deleteTarget.id}`, { method: 'DELETE' })
    setZones((prev) => prev.filter((z) => z.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  async function handleToggle(zone: DeliveryZone) {
    const next = !zone.is_active
    setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, is_active: next } : z))
    setToggleStates((s) => ({ ...s, [zone.id]: 'saving' }))
    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setZones((prev) => prev.map((z) => z.id === zone.id ? updated : z))
      setToggleStates((s) => ({ ...s, [zone.id]: 'saved' }))
      setTimeout(() => setToggleStates((s) => ({ ...s, [zone.id]: 'idle' })), 1200)
    } catch {
      setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, is_active: !next } : z))
      setToggleStates((s) => ({ ...s, [zone.id]: 'error' }))
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
                ${item.href === '/admin/delivery'
                  ? 'bg-brand-red/15 text-white ring-1 ring-brand-red/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-600">v1.0 · Reigate</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Delivery Zones</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading ? 'Loading…' : `${zones.length} zone${zones.length !== 1 ? 's' : ''} · ${zones.filter((z) => z.is_active).length} active`}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30">
            <Plus className="w-4 h-4" /> Add Zone
          </button>
        </header>

        <div className="flex-1 px-8 py-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MapPin className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-medium">No delivery zones yet</p>
              <p className="text-zinc-600 text-sm mt-1">Click "Add Zone" to get started.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Postcode Prefix</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Delivery Fee</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Min Order</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide w-28">Active</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {zones.map((zone) => (
                    <tr key={zone.id} className="bg-zinc-950/50 hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-white text-base">{zone.postcode_prefix}</span>
                        <p className="text-[11px] text-zinc-500 mt-0.5">e.g. {zone.postcode_prefix} 1AA</p>
                      </td>
                      <td className="px-5 py-3 text-zinc-200 font-medium">£{Number(zone.delivery_fee).toFixed(2)}</td>
                      <td className="px-5 py-3 text-zinc-400">
                        {Number(zone.min_order_amount) > 0 ? `£${Number(zone.min_order_amount).toFixed(2)}` : <span className="text-zinc-600">None</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(zone)}
                            role="switch"
                            aria-checked={zone.is_active}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors
                              focus:outline-none disabled:opacity-50
                              ${zone.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform
                              ${zone.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          {toggleStates[zone.id] === 'saving' && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
                          {toggleStates[zone.id] === 'saved'  && <Check className="w-3 h-3 text-emerald-400" />}
                          <span className={`text-xs font-medium ${zone.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                            {zone.is_active ? 'Active' : 'Off'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(zone)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(zone)}
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

      {showModal && <ZoneModal editingZone={editingZone} onClose={closeModal} onSave={handleSave} />}
      {deleteTarget && (
        <DeleteConfirm zone={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
