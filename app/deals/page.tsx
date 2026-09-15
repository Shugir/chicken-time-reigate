'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BundleGroupPicker from '@/components/Deals/BundleGroupPicker'

interface Deal {
  id: string
  type: 'bogo' | 'bundle' | 'fixed_meal' | 'order_discount'
  name: string
  config: any
}

interface MenuItem { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }

interface CartEntry { qty: number; removals: string[]; additions: string[]; extras: { name: string; price: number }[] }

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeBundle, setActiveBundle] = useState<Deal | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/deals/active').then((r) => r.json()),
      fetch('/api/menu-items').then((r) => r.json()),
    ]).then(([d, m]) => { setDeals(d); setMenuItems(m) })
  }, [])

  const menuItemsByCategory: Record<string, MenuItem[]> = {}
  for (const item of menuItems) {
    if (!item.is_available) continue
    ;(menuItemsByCategory[item.category] ??= []).push(item)
  }

  function addItemsToCart(itemIds: string[]) {
    const raw = sessionStorage.getItem('pendingCartEntries')
    const existing: Record<string, CartEntry> = raw ? JSON.parse(raw) : {}
    for (const id of itemIds) {
      existing[id] = existing[id]
        ? { ...existing[id], qty: existing[id].qty + 1 }
        : { qty: 1, removals: [], additions: [], extras: [] }
    }
    sessionStorage.setItem('pendingCartEntries', JSON.stringify(existing))
    router.push('/order?from=deal')
  }

  return (
    <div className="bg-white min-h-screen px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-zinc-900 mb-1">Deals</h1>
      <p className="text-zinc-500 text-sm mb-6">Auto-applied at checkout — no code needed.</p>

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="border border-zinc-100 rounded-2xl p-5">
            <p className="font-heading font-bold text-zinc-900">{deal.name}</p>
            {deal.type === 'bundle' && (
              <button
                onClick={() => setActiveBundle(deal)}
                className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                Build it — £{deal.config.price.toFixed(2)}
              </button>
            )}
            {deal.type === 'fixed_meal' && (
              <button
                onClick={() => addItemsToCart(deal.config.items.flatMap((it: any) => Array(it.qty).fill(it.item_id)))}
                className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                Add to Order — £{deal.config.price.toFixed(2)}
              </button>
            )}
            {(deal.type === 'bogo' || deal.type === 'order_discount') && (
              <p className="mt-2 text-xs text-zinc-400">Automatically applied when you qualify — just order normally.</p>
            )}
          </div>
        ))}
      </div>

      {activeBundle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
            <BundleGroupPicker
              groups={activeBundle.config.groups}
              price={activeBundle.config.price}
              menuItemsByCategory={menuItemsByCategory}
              onComplete={(selections) => {
                addItemsToCart(selections.map((s) => s.item_id))
                setActiveBundle(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
