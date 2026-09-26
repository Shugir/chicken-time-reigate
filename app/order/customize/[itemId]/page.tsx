'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, TriangleAlert } from 'lucide-react'
import ModifierForm, { EMPTY_SELECTION, type ModifierSelection } from '@/components/Menu/ModifierForm'
import ModifierSection from '@/components/Menu/ModifierSection'
import QtyStepper from '@/components/Menu/QtyStepper'
import { dbToMenuItem, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { extraQty, formatExtra, sectionCount, spicyPrice } from '@/lib/order-modifiers'
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
  const spicyCost = spicyPrice(config.spicyLevels, selection.spicy)
  // Same function the cart uses, so page total == cart total == checkout
  const unit = lineUnitPrice(item, { spicy_level: selection.spicy ?? undefined, extras: selection.extras })
  const total = unit * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const categoryLabel = (key?: string) => config.categories.find((c) => c.key === key)?.label ?? key
  const hasSelection =
    selection.spicy != null || selection.removals.length > 0 || selection.extras.length > 0 ||
    selection.additions.length > 0 || notes.trim().length > 0

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

  const addButton = (
    <button
      onClick={handleAdd}
      className="w-full min-h-[44px] font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20"
    >
      <span className="flex items-center gap-2 text-base">
        <ShoppingBag size={18} />
        {/* Mobile bar shares its row with the qty stepper, so it shows just "Add" */}
        Add<span className="hidden lg:inline">{qty > 1 ? ` ${qty}×` : ''} to Order</span>
      </span>
      <span className="text-base tabular-nums">£{total.toFixed(2)}</span>
    </button>
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
          {/* Left: hero + numbered sections */}
          <div className="lg:col-span-8 space-y-6">
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
                <h1 className="font-heading font-black text-3xl text-zinc-900 leading-tight">{item.name}</h1>
                {item.description && <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{item.description}</p>}
                <div className="mt-3">
                  {isOffer && (
                    <span className="text-sm text-zinc-400 line-through mr-2">£{item.compare_at_price!.toFixed(2)}</span>
                  )}
                  <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
                    £{item.price.toFixed(2)}
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

            <div className="rounded-2xl border border-zinc-100 overflow-hidden divide-y divide-zinc-100">
              <ModifierForm
                config={config}
                value={selection}
                onChange={setSelection}
                soldOut={item.sold_out_extras}
                numbered
              />
              <ModifierSection
                number={sectionCount(config) + 1}
                title="Special instructions"
                subtitle="Allergies, preferences or anything else"
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Extra sauce on the side, well done…"
                  rows={3}
                  maxLength={200}
                  aria-label="Special instructions"
                  className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
                />
              </ModifierSection>
            </div>
          </div>

          {/* Right: summary. Sticky sidebar on desktop, a plain card below the sections on mobile. */}
          <aside className="lg:col-span-4 lg:sticky lg:top-6 rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4" aria-label="Your order">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-zinc-900">Your selection</h2>
              <QtyStepper value={qty} onChange={setQty} label={item.name} min={1} max={99} />
            </div>

            {hasSelection ? (
              <ul className="space-y-1.5 text-sm">
                {selection.spicy && (
                  <li className="flex justify-between text-zinc-700">
                    <span>Spicy level: {selection.spicy}</span>
                    {spicyCost > 0 && <span className="tabular-nums">+£{spicyCost.toFixed(2)}</span>}
                  </li>
                )}
                {selection.removals.map((r) => (
                  <li key={`removed-${r}`} className="flex justify-between text-zinc-500">
                    <span className="line-through">{r}</span>
                    <span>Removed</span>
                  </li>
                ))}
                {selection.extras.map((e) => (
                  <li key={`${e.category}-${e.name}`} className="flex justify-between text-zinc-700">
                    <span>{formatExtra(e)} <span className="text-zinc-400 text-xs">({categoryLabel(e.category)})</span></span>
                    <span className="tabular-nums">{e.price > 0 ? `+£${(e.price * extraQty(e)).toFixed(2)}` : 'Free'}</span>
                  </li>
                ))}
                {selection.additions.map((a) => (
                  <li key={`add-${a}`} className="flex justify-between text-zinc-700">
                    <span>{a}</span>
                    <span className="text-zinc-400">Free</span>
                  </li>
                ))}
                {notes.trim() && (
                  <li className="text-zinc-500 italic pt-1 border-t border-zinc-100 mt-1">&ldquo;{notes.trim()}&rdquo;</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">No changes, served as described.</p>
            )}

            <div className="flex justify-between items-baseline border-t border-zinc-100 pt-4">
              <span className="text-sm text-zinc-500">Total</span>
              <span className="font-heading font-black text-2xl text-zinc-900 tabular-nums">£{total.toFixed(2)}</span>
            </div>

            <div className="hidden lg:block">{addButton}</div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} label={item.name} min={1} max={99} />
        <div className="flex-1 min-w-0">{addButton}</div>
      </div>
    </div>
  )
}
