'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

type DealType = 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'

interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  is_active: boolean
}

interface Category { id: string; name: string; slug: string }

const TYPE_LABELS: Record<DealType, string> = {
  bogo: 'BOGO',
  bundle: 'Build-a-Bundle',
  fixed_meal: 'Fixed-Price Meal',
  order_discount: 'Order/Category Discount',
}

const EMPTY_CONFIG: Record<DealType, any> = {
  bogo: { buy: { category: '', qty: 1 }, get: { category: '', qty: 1, discount: 'free' } },
  bundle: { groups: [{ label: '', category: '', pick_qty: 1 }], price: 0 },
  fixed_meal: { items: [{ item_id: '', qty: 1 }], price: 0 },
  order_discount: { scope: 'order', discount: { type: 'percent', value: 10 } },
}

export default function DealsAdminPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Deal | null>(null)
  const [creatingType, setCreatingType] = useState<DealType | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/deals').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([d, c]) => { setDeals(d); setCategories(c) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

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

  async function handleSave(payload: { type: DealType; name: string; config: any }) {
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

  const formType = editing?.type ?? creatingType

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Deals</h1>
              <p className="text-zinc-400 text-sm">BOGO, bundles, fixed-price meals and order-wide discounts — auto-applied at checkout.</p>
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
          initial={editing ?? { type: formType, name: '', config: EMPTY_CONFIG[formType], is_active: true } as any}
          error={error}
          onCancel={() => { setEditing(null); setCreatingType(null); setError(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function DealFormModal({ type, categories, initial, error, onCancel, onSave }: {
  type: DealType
  categories: Category[]
  initial: Deal
  error: string | null
  onCancel: () => void
  onSave: (payload: { type: DealType; name: string; config: any }) => void
}) {
  const [name, setName] = useState(initial.name)
  const [config, setConfig] = useState<any>(initial.config)

  function set(path: (string | number)[], value: any) {
    setConfig((prev: any) => {
      const next = structuredClone(prev)
      let cur = next
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]]
      cur[path[path.length - 1]] = value
      return next
    })
  }

  const categoryOptions = (
    <>
      <option value="">— choose category —</option>
      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
    </>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{TYPE_LABELS[type]}</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

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

          {type === 'bogo' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Buy category</label>
                  <select value={config.buy.category} onChange={(e) => set(['buy', 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Buy qty</label>
                  <input type="number" min={1} value={config.buy.qty} onChange={(e) => set(['buy', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Get category</label>
                  <select value={config.get.category} onChange={(e) => set(['get', 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                    {categoryOptions}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Get qty</label>
                  <input type="number" min={1} value={config.get.qty} onChange={(e) => set(['get', 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
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
            </>
          )}

          {type === 'bundle' && (
            <>
              {config.groups.map((g: any, i: number) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Label</label>
                    <input value={g.label} onChange={(e) => set(['groups', i, 'label'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                    <select value={g.category} onChange={(e) => set(['groups', i, 'category'], e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                      {categoryOptions}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Pick qty</label>
                    <input type="number" min={1} value={g.pick_qty} onChange={(e) => set(['groups', i, 'pick_qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => set(['groups'], [...config.groups, { label: '', category: '', pick_qty: 1 }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add group
              </button>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Bundle price (£)</label>
                <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </>
          )}

          {type === 'fixed_meal' && (
            <>
              {config.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Menu item ID</label>
                    <input value={it.item_id} onChange={(e) => set(['items', i, 'item_id'], e.target.value)} placeholder="paste from Menu Manager" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Qty</label>
                    <input type="number" min={1} value={it.qty} onChange={(e) => set(['items', i, 'qty'], parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => set(['items'], [...config.items, { item_id: '', qty: 1 }])}
                className="text-xs text-brand-red hover:underline"
              >
                + Add item
              </button>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fixed price (£)</label>
                <input type="number" min={0} step="0.01" value={config.price} onChange={(e) => set(['price'], parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
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
              <div className="grid grid-cols-2 gap-3">
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

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-zinc-700">
            Cancel
          </button>
          <button
            onClick={() => onSave({ type, name, config })}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-brand-red hover:bg-brand-red/80 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
