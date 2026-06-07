'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tag, Plus, X, Loader2, Check, Pencil, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { AdminDataTable, type Column } from '@/components/AdminDataTable'

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

const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red'

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

    setSaving(true)
    try {
      const url    = editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), discount_type: type, discount_value: val, min_order_amount: minNum }),
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
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Promo Code <span className="text-red-400">*</span></label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. GRANDOPENING"
              className={`w-full uppercase tracking-wider font-mono ${inputCls}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Discount Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'flat' | 'percentage')} className={`w-full ${inputCls}`}>
              <option value="flat">Flat amount (£ off subtotal)</option>
              <option value="percentage">Percentage (% off subtotal)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Value ({type === 'flat' ? '£' : '%'})</label>
              <input type="number" step={type === 'flat' ? '0.01' : '1'} min="0" max={type === 'percentage' ? '100' : undefined}
                value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'flat' ? '5.00' : '10'}
                className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Order (£)</label>
              <input type="number" step="0.01" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                placeholder="0.00" className={`w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${inputCls}`} />
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
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [promos, setPromos]             = useState<Promotion[]>([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [toggleStates, setToggleStates] = useState<Record<string, SaveState>>({})

  async function fetchPromos(query: string) {
    setLoading(true)
    const sp = new URLSearchParams()
    if (query) sp.set('q', query)
    const r = await fetch(`/api/admin/promotions?${sp}`)
    if (r.ok) setPromos(await r.json())
    setLoading(false)
  }

  useEffect(() => { fetchPromos(q) }, [q])

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
      render: (p) => <span className="font-mono font-bold text-white text-base tracking-wider">{p.code}</span>,
    },
    {
      key: 'discount',
      label: 'Discount',
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            p.discount_type === 'flat' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-violet-500/15 text-violet-400'
          }`}>
            {p.discount_type === 'flat' ? '£ flat' : '% off'}
          </span>
          <span className="text-white font-semibold">
            {p.discount_type === 'flat' ? `£${Number(p.discount_value).toFixed(2)}` : `${Number(p.discount_value)}%`}
          </span>
        </div>
      ),
    },
    {
      key: 'min',
      label: 'Min Order',
      render: (p) => Number(p.min_order_amount) > 0
        ? <span className="text-zinc-400">£{Number(p.min_order_amount).toFixed(2)}</span>
        : <span className="text-zinc-600">None</span>,
    },
    {
      key: 'active',
      label: 'Active',
      render: (p) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleToggle(p)} role="switch" aria-checked={p.is_active}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${p.is_active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Promotions</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {loading ? 'Loading…' : `${promos.length} code${promos.length !== 1 ? 's' : ''} · ${promos.filter((p) => p.is_active).length} active`}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30">
            <Plus className="w-4 h-4" /> Add Promotion
          </button>
        </header>

        <div className="flex-1 px-8 py-6 overflow-auto">
          <AdminDataTable
            columns={columns}
            data={promos}
            loading={loading}
            searchPlaceholder="Search by promo code…"
            emptyIcon={<Tag className="w-12 h-12" />}
            emptyText={q ? 'No promotions match your search' : 'No promotions yet'}
            keyExtractor={(p) => p.id}
          />
        </div>
      </main>

      {showModal && <PromoModal editing={editing} onClose={closeModal} onSave={handleSave} />}
      {deleteTarget && (
        <DeleteConfirm promo={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
