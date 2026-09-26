'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, TriangleAlert } from 'lucide-react'
import { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import GroupedCustomizer from '@/components/Menu/GroupedCustomizer'
import QtyStepper from '@/components/Menu/QtyStepper'
import SelectionReceipt from '@/components/Menu/SelectionReceipt'
import { customizerLayout, receiptLines } from '@/lib/customizer-layout'
import { dbToMenuItem, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { queueCartLine } from '@/lib/use-cart'

export default function CustomizeItemPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [qty, setQty] = useState(1)
  const [selection, setSelection] = useState<ModifierSelection>(EMPTY_SELECTION)
  const [notes, setNotes] = useState('')
  // Blocks a second Add tap while navigation is in flight (it would queue the line twice)
  const adding = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/menu-items')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<DbMenuItem[]>
      })
      .then((rows) => {
        if (cancelled) return
        const row = rows.find((r) => r.id === itemId)
        // Unknown id or sold out: nothing to customize here
        if (!row || !row.is_available) return router.replace('/order')
        setItem(dbToMenuItem(row))
      })
      .catch((err) => {
        console.error('Failed to load menu item:', err)
        if (!cancelled) router.replace('/order')
      })
    return () => { cancelled = true }
  }, [itemId, router])

  const goBack = () => (window.history.length > 1 ? router.back() : router.push('/order'))

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-pulse" role="status" aria-busy="true" aria-label="Loading item">
        <div className="h-5 w-32 bg-zinc-100 rounded mb-6" />
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-64 bg-zinc-100 rounded-3xl" />
            <div className="h-40 bg-zinc-100 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 h-72 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  const config = itemConfig(item)
  const layout = customizerLayout(config)
  const lines = receiptLines(layout, config, selection, notes)
  // Same function the cart uses, so page total == cart total == checkout
  const unit = lineUnitPrice(item, { spicy_level: selection.spicy ?? undefined, extras: selection.extras })
  const total = unit * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const badges = [...new Set([item.badge, ...(item.dietaryFlags ?? [])])].filter((b): b is string => !!b)
  const receiptNumber = String(layout.length + 2).padStart(2, '0')

  const handleAdd = () => {
    if (adding.current) return
    adding.current = true
    try {
      queueCartLine(sessionStorage, item.id, {
        spicy_level: selection.spicy ?? undefined,
        removals: selection.removals,
        additions: selection.additions,
        extras: selection.extras,
        notes: notes.trim() || undefined,
      }, qty)
    } catch {
      // sessionStorage itself throws when site data is blocked: the line can't be queued
    }
    // replace, so browser Back from /order doesn't reopen this page
    router.replace('/order')
  }

  const handleReset = () => {
    setSelection(EMPTY_SELECTION)
    setNotes('')
    setQty(1)
  }

  const receipt = (showActions: boolean) => (
    <SelectionReceipt
      number={receiptNumber}
      itemName={item.name}
      basePrice={item.price}
      unit={unit}
      qty={qty}
      onQtyChange={setQty}
      lines={lines}
      onAdd={handleAdd}
      onReset={handleReset}
      showActions={showActions}
    />
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-32 lg:pb-12">
        <button
          onClick={goBack}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to menu
        </button>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: hero + numbered groups */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            <header className="grid sm:grid-cols-2 gap-5 items-center">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100">
                <Image src={item.image} alt={item.name} fill priority sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
                {isOffer && (
                  <div className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl shadow-lg">
                    🔥 OFFER
                  </div>
                )}
              </div>
              <div>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {badges.map((b) => (
                      <span key={b} className="rounded-md px-2 py-0.5 bg-brand-red/10 text-brand-red text-[11px] font-bold uppercase">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="font-heading font-black text-3xl text-zinc-900 leading-tight">{item.name}</h1>
                {item.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{item.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {isOffer && (
                      <span className="text-sm text-zinc-400 line-through mr-2">£{item.compare_at_price!.toFixed(2)}</span>
                    )}
                    <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
                      £{item.price.toFixed(2)}
                    </span>
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Base meal price <span className="tabular-nums text-zinc-700">£{item.price.toFixed(2)}</span>
                  </span>
                </div>
                {item.allergens.length > 0 && (
                  <p className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-800 text-xs font-medium w-fit">
                    <TriangleAlert size={12} className="shrink-0" />
                    Contains: {item.allergens.join(', ')}
                  </p>
                )}
              </div>
            </header>

            <GroupedCustomizer
              layout={layout}
              config={config}
              value={selection}
              onChange={setSelection}
              notes={notes}
              onNotesChange={setNotes}
              soldOut={item.sold_out_extras}
            />

            {/* Mobile: the receipt sits below the groups; the sticky bar below carries Add */}
            <div className="lg:hidden">{receipt(false)}</div>
          </div>

          {/* Desktop: sticky receipt with Add / Reset */}
          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-6 self-start">{receipt(true)}</div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} label={item.name} min={1} max={99} />
        <button
          onClick={handleAdd}
          className="flex-1 min-w-0 min-h-[44px] font-bold text-sm sm:text-base py-4 rounded-2xl flex items-center justify-center gap-1.5 px-3 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20"
        >
          <ShoppingBag size={18} className="shrink-0" />
          {/* Only the words may truncate; the price always shows in full */}
          <span className="truncate">Add to bag</span>
          <span className="shrink-0 tabular-nums">£{total.toFixed(2)}</span>
        </button>
      </div>
    </div>
  )
}
