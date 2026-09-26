'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { DealType } from '@/lib/deal-engine'

interface Deal {
  id: string
  type: DealType
  name: string
  config: any
  custom_label: string | null
  image_url: string | null
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])

  useEffect(() => {
    fetch('/api/deals/active').then((r) => r.json()).then(setDeals)
  }, [])

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
                  onClick={() => router.push(`/order/deal/${deal.id}`)}
                  className="mt-3 bg-brand-red text-white text-sm font-semibold px-4 py-2 rounded-xl"
                >
                  Build it — {deal.config.price_type === 'percent' ? `${deal.config.discount_percent}% off` : `£${deal.config.price.toFixed(2)}`}
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
    </div>
  )
}
