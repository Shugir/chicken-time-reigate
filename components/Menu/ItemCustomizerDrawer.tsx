'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { X, Plus, Minus, ShoppingBag, TriangleAlert } from 'lucide-react'
import type { ProductItem, OrderSelection } from '@/components/ProductModal'
import { toModifierConfig, unitPrice, spicyPrice, extraQty, formatExtra } from '@/lib/order-modifiers'
import ModifierSection from './ModifierSection'
import ModifierForm, { EMPTY_SELECTION, type ModifierSelection } from './ModifierForm'

type DrawerItem = ProductItem & {
  compare_at_price?: number | null
  dietaryFlags?: string[]
  sold_out_extras?: string[]
}

interface Props {
  item: DrawerItem
  onClose: () => void
  onAddToOrder: (selection: OrderSelection) => void
}

export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder }: Props) {
  const [visible, setVisible] = useState(false)
  const [qty, setQty] = useState(1)
  const [selection, setSelection] = useState<ModifierSelection>(EMPTY_SELECTION)
  const [notes, setNotes] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Rows that predate Phase 1 arrive without `modifiers`; the contract's legacy
  // fallback turns their flat removals/extras into the same shape.
  const config = useMemo(
    () => item.modifiers ?? toModifierConfig({ removals: item.removables, additions: item.additions, extras: item.add_ons }),
    [item],
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    panelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const spicyCost = spicyPrice(config.spicyLevels, selection.spicy)
  // Must match lib/checkout-pricing, which rejects the order on any difference
  const unit = unitPrice(item.price + spicyCost, selection.extras)
  const total = unit * qty
  const extrasSum = unit - item.price
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price

  const hasSelection =
    selection.spicy != null || selection.removals.length > 0 || selection.extras.length > 0 ||
    selection.additions.length > 0 || notes.trim().length > 0
  const categoryLabel = (key?: string) => config.categories.find((c) => c.key === key)?.label ?? key

  const handleAdd = () => {
    onAddToOrder({
      item,
      quantity: qty,
      spicy_level: selection.spicy ?? undefined,
      removals: selection.removals,
      additions: selection.additions,
      extras: selection.extras,
      notes: notes.trim(),
      totalPrice: total,
    })
    onClose()
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Phone: bottom sheet. Desktop: centered card. */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5" onClick={onClose}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Customise ${item.name}`}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] outline-none transition-all duration-200 ${
            visible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-8 sm:translate-y-3 sm:scale-95'
          }`}
        >
          {/* Hero image */}
          <div className="relative h-44 sm:h-56 shrink-0 overflow-hidden bg-zinc-100">
            <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/50" aria-hidden="true" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors z-20"
            >
              <X size={16} />
            </button>
            {isOffer && (
              <div className="absolute top-0 right-16 bg-brand-red text-white text-[11px] font-black px-3 py-1.5 rounded-b-xl flex items-center gap-1 shadow-lg">
                🔥 OFFER
              </div>
            )}
            <div className="absolute bottom-4 left-5 right-16">
              <h2 className="font-heading font-black text-xl text-white leading-tight">{item.name}</h2>
              {item.description && <p className="text-white/70 text-sm mt-1 line-clamp-2">{item.description}</p>}
              {item.allergens && item.allergens.length > 0 && (
                <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 text-xs font-medium w-fit">
                  <TriangleAlert size={11} className="shrink-0" />
                  Contains: {item.allergens.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Price & quantity */}
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <div>
              {isOffer && (
                <span className="text-sm text-zinc-400 line-through mr-2">£{item.compare_at_price!.toFixed(2)}</span>
              )}
              <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
                £{item.price.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty === 1}
                aria-label="Decrease quantity"
                className="w-11 h-11 rounded-full border-2 border-zinc-200 flex items-center justify-center text-zinc-700 hover:border-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-200 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center font-bold text-lg text-zinc-900 tabular-nums" aria-live="polite">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
                className="w-11 h-11 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100">
            <ModifierForm
              config={config}
              value={selection}
              onChange={setSelection}
              soldOut={item.sold_out_extras}
            />

            <ModifierSection title="Special instructions" subtitle="Allergies, preferences or anything else">
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

            {hasSelection && (
              <ModifierSection title="Your selection" subtitle="What you've chosen for this item">
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
              </ModifierSection>
            )}
          </div>

          {/* Sticky footer */}
          <div className="border-t border-zinc-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white shrink-0">
            {extrasSum > 0 && (
              <div className="flex justify-between text-xs text-zinc-400 mb-2">
                <span>Extras</span>
                <span>+£{extrasSum.toFixed(2)}</span>
              </div>
            )}
            <button
              onClick={handleAdd}
              className="w-full min-h-[44px] font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20"
            >
              <span className="flex items-center gap-2 text-base">
                <ShoppingBag size={18} />
                Add{qty > 1 ? ` ${qty}×` : ''} to Order
              </span>
              <span className="text-base tabular-nums">£{total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
