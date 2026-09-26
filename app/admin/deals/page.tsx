'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { TYPE_LABELS, type Deal, type DealType } from '@/components/admin/deal-editor/shared'

export default function DealsAdminPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/deals')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDeals(d) })
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen bg-zinc-950 text-white overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Deals</h1>
              <p className="text-zinc-400 text-sm">BOGO, bundles and order-wide discounts — auto-applied at checkout.</p>
            </div>
            {/* Tap (not hover) opens the type menu, so it works on touch screens; each type opens the add page */}
            <details className="relative group">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-11 flex items-center gap-2 bg-brand-red hover:bg-brand-red/80 text-white text-sm font-semibold px-4 py-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Plus className="w-4 h-4" /> New Deal
              </summary>
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-10">
                {(Object.keys(TYPE_LABELS) as DealType[]).map((t) => (
                  <Link
                    key={t}
                    href={`/admin/deals/new?type=${t}`}
                    className="block w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 first:rounded-t-xl last:rounded-b-xl"
                  >
                    {TYPE_LABELS[t]}
                  </Link>
                ))}
              </div>
            </details>
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
                  <Link href={`/admin/deals/${deal.id}`} aria-label={`Edit ${deal.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleDelete(deal.id)} aria-label={`Delete ${deal.name}`} className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(deal.id, !deal.is_active)}
                    role="switch"
                    aria-checked={deal.is_active}
                    aria-label={`${deal.name} active`}
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

    </div>
  )
}
