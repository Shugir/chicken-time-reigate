'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import DealSlotPicker from '@/components/Deals/DealSlotPicker'
import type { DealType } from '@/lib/deal-engine'

interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  custom_label: string | null
  image_url: string | null
}

// Mirrors the `.select()` list in app/api/menu-items/route.ts.
interface DbMenuItem {
  id: string
  name: string
  price: number
  image_url: string | null
  category: string
  is_available: boolean
  extras: { name: string; price: number }[] | null
  removals: string[] | null
  additions: string[] | null
  custom_options: {
    removables?: string[]
    add_ons?: { name: string; price: number }[]
  } | null
}

// Mirrors the (non-exported) SlotItem type DealSlotPicker accepts.
interface SlotItem {
  id: string
  name: string
  price: number
  image_url: string | null
  category: string
  extras: { name: string; price: number }[] | null
  removals: string[] | null
  additions: string[] | null
}

interface Pick {
  item_id: string
  qty: number
  removals: string[]
  additions: string[]
  extras: { name: string; price: number }[]
}

interface CartEntry { qty: number; removals: string[]; additions: string[]; extras: { name: string; price: number }[] }

// Legacy rows keep options under custom_options; the order page reconciles the same way,
// so an item is customizable on both pages or neither.
function toSlotItem(item: DbMenuItem): SlotItem {
  const opts = item.custom_options ?? {}
  return {
    id: item.id,
    name: item.name,
    price: Number(item.price),
    image_url: item.image_url,
    category: item.category,
    extras: item.extras?.length ? item.extras : (opts.add_ons ?? null),
    removals: item.removals?.length ? item.removals : (opts.removables ?? null),
    additions: item.additions,
  }
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([])
  const [activeBundle, setActiveBundle] = useState<Deal | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/deals/active').then((r) => r.json()),
      fetch('/api/menu-items').then((r) => r.json()),
    ]).then(([d, m]) => { setDeals(d); setMenuItems(m) })
  }, [])

  const itemsById = useMemo(
    () => new Map<string, SlotItem>(
      menuItems.filter((m) => m.is_available).map((m) => [m.id, toSlotItem(m)])
    ),
    [menuItems]
  )

  function addPicksToCart(picks: Pick[]) {
    const raw = sessionStorage.getItem('pendingCartEntries')
    const existing: Record<string, CartEntry> = raw ? JSON.parse(raw) : {}
    for (const pick of picks) {
      const current = existing[pick.item_id]
      existing[pick.item_id] = current
        ? { ...current, qty: current.qty + pick.qty }
        : { qty: pick.qty, removals: pick.removals, additions: pick.additions, extras: pick.extras }
    }
    sessionStorage.setItem('pendingCartEntries', JSON.stringify(existing))
    router.push('/order?from=deal')
  }

  return (
    <div className="bg-white min-h-screen px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <h1 className="font-heading font-black text-2xl text-zinc-900 mb-1">Deals</h1>
      <p className="text-zinc-500 text-sm mb-6">Build a bundle below, or qualifying discounts apply automatically at checkout.</p>

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="border border-zinc-100 rounded-2xl p-5 flex items-center gap-4">
            {deal.image_url && (
              <div className="relative w-16 h-16 shrink-0">
                <Image src={deal.image_url} alt="" fill className="object-cover rounded-xl" sizes="64px" />
              </div>
            )}
            <div className="flex-1">
              <p className="font-heading font-bold text-zinc-900">{deal.custom_label || deal.name}</p>
              {deal.type === 'bundle' && (
                <button
                  onClick={() => setActiveBundle(deal)}
                  className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  Build it — £{deal.config.price.toFixed(2)}
                </button>
              )}
              {(deal.type === 'bogo' || deal.type === 'order_discount') && (
                <p className="mt-2 text-xs text-zinc-400">Automatically applied when you qualify — just order normally.</p>
              )}
            </div>
          </div>
        ))}
        {deals.length === 0 && (
          <p className="text-sm text-zinc-400">No active deals right now.</p>
        )}
      </div>

      {activeBundle && (
        <DealSlotPicker
          deal={activeBundle}
          itemsById={itemsById}
          onClose={() => setActiveBundle(null)}
          onComplete={(picks) => {
            addPicksToCart(picks)
            setActiveBundle(null)
          }}
        />
      )}
    </div>
  )
}
