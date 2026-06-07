'use client'

import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface ComboDiscount {
  id: string
  meal_size: string
  name: string
  discount_amount: number
  is_active: boolean
}

export default function CombosAdminPage() {
  const [combos, setCombos] = useState<ComboDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<Record<string, { name: string; discount_amount: string }>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/combo-discounts')
      .then(r => r.json())
      .then((data: ComboDiscount[]) => {
        setCombos(data)
        const vals: Record<string, { name: string; discount_amount: string }> = {}
        data.forEach(d => { vals[d.id] = { name: d.name, discount_amount: String(d.discount_amount) } })
        setEditVals(vals)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(id: string) {
    setError(null)
    setSaving(true)
    const vals = editVals[id]
    const amount = parseFloat(vals.discount_amount)
    if (isNaN(amount) || amount < 0) {
      setError('Discount amount must be a non-negative number')
      setSaving(false)
      return
    }
    const res = await fetch(`/api/admin/combo-discounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: vals.name.trim(), discount_amount: amount }),
    })
    const updated = await res.json()
    if (!res.ok) {
      setError(updated.error ?? 'Save failed')
    } else {
      setCombos(prev => prev.map(c => c.id === id ? updated : c))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleToggle(id: string, is_active: boolean) {
    const res = await fetch(`/api/admin/combo-discounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (res.ok) {
      setCombos(prev => prev.map(c => c.id === id ? { ...c, is_active } : c))
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Combo Discounts</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Discount applied when a customer builds a combo meal. Tag menu items with a Combo Role
            and Size Tier in the{' '}
            <a href="/admin" className="text-brand-red hover:underline">Menu Manager</a>.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-zinc-500 text-sm">Loading...</div>
          ) : (
            <div className="space-y-3">
              {combos.map(combo => (
                <div
                  key={combo.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-red px-2 py-0.5 bg-brand-red/10 rounded">
                        {combo.meal_size}
                      </span>
                      {!combo.is_active && (
                        <span className="text-xs text-zinc-600">inactive</span>
                      )}
                    </div>

                    {editingId === combo.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editVals[combo.id]?.name ?? ''}
                          onChange={e =>
                            setEditVals(prev => ({ ...prev, [combo.id]: { ...prev[combo.id], name: e.target.value } }))
                          }
                          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:ring-1 focus:ring-brand-red"
                          placeholder="Discount name"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-400 text-sm">£</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editVals[combo.id]?.discount_amount ?? ''}
                            onChange={e =>
                              setEditVals(prev => ({
                                ...prev,
                                [combo.id]: { ...prev[combo.id], discount_amount: e.target.value },
                              }))
                            }
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white w-24 focus:outline-none focus:ring-1 focus:ring-brand-red"
                          />
                        </div>
                        <button
                          onClick={() => handleSave(combo.id)}
                          disabled={saving}
                          className="flex items-center gap-1 bg-brand-red hover:bg-brand-red/80 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setError(null) }}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm px-2 py-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">{combo.name}</span>
                        <span className="text-emerald-400 font-semibold text-sm">
                          −£{Number(combo.discount_amount).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setEditingId(combo.id)}
                          className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggle(combo.id, !combo.is_active)}
                    title={combo.is_active ? 'Disable' : 'Enable'}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      combo.is_active ? 'bg-brand-red' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        combo.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
