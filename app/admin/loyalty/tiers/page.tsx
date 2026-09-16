'use client'

import { useState, useEffect } from 'react'
import {
  Loader2, Plus, Pencil, X, Check, ChevronUp, ChevronDown, Trophy, AlertTriangle,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface Tier {
  id: string
  name: string
  threshold: number
  multiplier: number
  sort_order: number
  customer_count: number
  reward_count: number
}

interface TierForm {
  name: string
  threshold: string
  multiplier: string
}

const EMPTY_FORM: TierForm = { name: '', threshold: '0', multiplier: '1.00' }

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red'

export default function LoyaltyTiersPage() {
  const [tiers, setTiers]   = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Tier | null>(null)
  const [form, setForm]     = useState<TierForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Tier | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchTiers() {
    const res = await fetch('/api/admin/loyalty/tiers')
    if (res.ok) setTiers(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchTiers() }, [])

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setSaveError(''); setShowForm(true)
  }

  function openEdit(tier: Tier) {
    setEditing(tier)
    setForm({ name: tier.name, threshold: String(tier.threshold), multiplier: String(tier.multiplier) })
    setSaveError(''); setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    const threshold = parseInt(form.threshold, 10)
    if (!Number.isInteger(threshold) || threshold < 0) { setSaveError('Threshold must be a whole number of points, 0 or more'); return }
    const multiplier = parseFloat(form.multiplier)
    if (!Number.isFinite(multiplier) || multiplier <= 0) { setSaveError('Multiplier must be greater than 0'); return }

    setSaving(true); setSaveError('')
    try {
      const body = { name: form.name.trim(), threshold, multiplier }
      const res = editing
        ? await fetch(`/api/admin/loyalty/tiers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/admin/loyalty/tiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { setSaveError((await res.json()).error ?? 'Save failed'); return }
      await fetchTiers()
      setShowForm(false)
    } finally { setSaving(false) }
  }

  async function handleMove(tier: Tier, direction: 'up' | 'down') {
    const idx = tiers.findIndex((t) => t.id === tier.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= tiers.length) return
    const other = tiers[swapIdx]
    await Promise.all([
      fetch(`/api/admin/loyalty/tiers/${tier.id}`,  { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: other.sort_order }) }),
      fetch(`/api/admin/loyalty/tiers/${other.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: tier.sort_order }) }),
    ])
    await fetchTiers()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/admin/loyalty/tiers/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      await fetchTiers()
    } finally { setDeleting(false) }
  }

  const inUse = deleteTarget ? deleteTarget.customer_count + deleteTarget.reward_count > 0 : false

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Loyalty Tiers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Points thresholds and earn-rate multipliers, lowest tier first</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Tier
          </button>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : tiers.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">No tiers yet</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide w-20">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Threshold</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Earn Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">In Use</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {tiers.map((tier, idx) => (
                    <tr key={tier.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleMove(tier, 'up')} disabled={idx === 0} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleMove(tier, 'down')} disabled={idx === tiers.length - 1} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-white font-medium">{tier.name}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-zinc-400">{tier.threshold.toLocaleString()} pts</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          ×{Number(tier.multiplier).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-zinc-500 text-xs">
                          {tier.customer_count} customer{tier.customer_count !== 1 ? 's' : ''} · {tier.reward_count} reward{tier.reward_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(tier)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(tier)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <X className="w-3.5 h-3.5" />
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Tier' : 'Add Tier'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Threshold (points) *</label>
                <input type="number" step="1" min="0" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} className={inputCls} />
                <p className="text-xs text-zinc-600 mt-1">Lifetime points a customer must earn to reach this tier.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Earn Multiplier *</label>
                <input type="number" step="0.05" min="0.05" value={form.multiplier} onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))} className={inputCls} />
                <p className="text-xs text-zinc-600 mt-1">Points earned per order are multiplied by this. 1.00 = standard rate.</p>
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-red hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'Save Changes' : 'Add Tier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-2">Delete &quot;{deleteTarget.name}&quot;?</h2>
            {inUse ? (
              <div className="flex gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {deleteTarget.customer_count} customer{deleteTarget.customer_count !== 1 ? 's are' : ' is'} on this tier and{' '}
                  {deleteTarget.reward_count} reward{deleteTarget.reward_count !== 1 ? 's require' : ' requires'} it.
                  Deleting drops those customers to no tier and makes those rewards available to everyone.
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mb-5">No customers or rewards reference this tier.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
