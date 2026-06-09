'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapPin, Plus, X, Loader2, Check, Pencil, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { AdminDataTable, type Column } from '@/components/AdminDataTable'

interface DeliveryZone {
  id: string
  postcode_prefix: string
  delivery_fee: number
  min_order_amount: number
  free_delivery_threshold: number | null
  is_active: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

function ZoneModal({ editingZone, onClose, onSave }: {
  editingZone: DeliveryZone | null
  onClose: () => void
  onSave: (zone: DeliveryZone) => void
}) {
  const [prefix, setPrefix]           = useState(editingZone?.postcode_prefix ?? '')
  const [fee, setFee]                 = useState(editingZone ? String(editingZone.delivery_fee) : '1.99')
  const [minOrder, setMinOrder]       = useState(editingZone ? String(editingZone.min_order_amount) : '0')
  const [freeThreshold, setFreeThreshold] = useState(
    editingZone?.free_delivery_threshold != null ? String(editingZone.free_delivery_threshold) : '',
  )
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!prefix.trim()) return setError('Postcode prefix is required.')
    const feeNum = parseFloat(fee)
    const minNum = parseFloat(minOrder)
    if (isNaN(feeNum) || feeNum < 0) return setError('Invalid delivery fee.')
    if (isNaN(minNum) || minNum < 0) return setError('Invalid minimum order.')

    setSaving(true)
    try {
      const url    = editingZone ? `/api/admin/delivery-zones/${editingZone.id}` : '/api/admin/delivery-zones'
      const method = editingZone ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postcode_prefix: prefix.trim().toUpperCase(),
          delivery_fee: feeNum,
          min_order_amount: minNum,
          free_delivery_threshold: freeThreshold.trim() !== '' ? parseFloat(freeThreshold) : null,
        }),
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
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Postcode Prefix <span className="text-red-400">*</span></label>
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
              <input type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)}
                placeholder="1.99" className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Order (£)</label>
              <input type="number" step="0.01" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00" className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Free Delivery Threshold (£)</label>
            <input type="number" step="0.01" min="0" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)}
              placeholder="e.g. 25.00" className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
            <p className="text-[11px] text-zinc-600 mt-1">Optional. If cart subtotal meets this amount, delivery becomes £0.00. Leave blank for no free delivery threshold.</p>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
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

function DeleteConfirm({ zone, onClose, onConfirm }: { zone: DeliveryZone; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Delete &quot;{zone.postcode_prefix}&quot;?</h3>
        <p className="text-zinc-400 text-sm mb-5">Customers in this area will no longer be able to order.</p>
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

export default function DeliveryPage() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [zones, setZones]               = useState<DeliveryZone[]>([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editingZone, setEditingZone]   = useState<DeliveryZone | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null)
  const [toggleStates, setToggleStates] = useState<Record<string, SaveState>>({})

  async function fetchZones(query: string) {
    setLoading(true)
    const sp = new URLSearchParams()
    if (query) sp.set('q', query)
    const r = await fetch(`/api/admin/delivery-zones?${sp}`)
    if (r.ok) setZones(await r.json())
    setLoading(false)
  }

  useEffect(() => { fetchZones(q) }, [q])

  function openAdd()                { setEditingZone(null); setShowModal(true) }
  function openEdit(z: DeliveryZone) { setEditingZone(z); setShowModal(true) }
  function closeModal()             { setShowModal(false); setEditingZone(null) }

  function handleSave(zone: DeliveryZone) {
    setZones((prev) => prev.some((z) => z.id === zone.id) ? prev.map((z) => z.id === zone.id ? zone : z) : [...prev, zone])
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

  const columns: Column<DeliveryZone>[] = [
    {
      key: 'postcode',
      label: 'Postcode Prefix',
      render: (z) => (
        <div>
          <span className="font-mono font-bold text-white text-base">{z.postcode_prefix}</span>
          <p className="text-[11px] text-zinc-500 mt-0.5">e.g. {z.postcode_prefix} 1AA</p>
        </div>
      ),
    },
    {
      key: 'fee',
      label: 'Delivery Fee',
      render: (z) => <span className="text-zinc-200 font-medium">£{Number(z.delivery_fee).toFixed(2)}</span>,
    },
    {
      key: 'min',
      label: 'Min Order',
      render: (z) => Number(z.min_order_amount) > 0
        ? <span className="text-zinc-400">£{Number(z.min_order_amount).toFixed(2)}</span>
        : <span className="text-zinc-600">None</span>,
    },
    {
      key: 'free_threshold',
      label: 'Free Delivery Over',
      render: (z) => z.free_delivery_threshold && Number(z.free_delivery_threshold) > 0
        ? <span className="text-emerald-400 font-medium">£{Number(z.free_delivery_threshold).toFixed(2)}</span>
        : <span className="text-zinc-600">None</span>,
    },
    {
      key: 'active',
      label: 'Active',
      render: (z) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle(z)}
            role="switch"
            aria-checked={z.is_active}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${z.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${z.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          {toggleStates[z.id] === 'saving' && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
          {toggleStates[z.id] === 'saved'  && <Check className="w-3 h-3 text-emerald-400" />}
          <span className={`text-xs font-medium ${z.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {z.is_active ? 'Active' : 'Off'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (z) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(z)}
            className="p-1.5 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeleteTarget(z)}
            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

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
          <AdminDataTable
            columns={columns}
            data={zones}
            loading={loading}
            searchPlaceholder="Search by postcode prefix…"
            emptyIcon={<MapPin className="w-12 h-12" />}
            emptyText={q ? 'No zones match your search' : 'No delivery zones yet'}
            keyExtractor={(z) => z.id}
          />
        </div>
      </main>

      {showModal && <ZoneModal editingZone={editingZone} onClose={closeModal} onSave={handleSave} />}
      {deleteTarget && (
        <DeleteConfirm zone={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
