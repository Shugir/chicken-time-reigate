'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { X, Plus, Minus, ShoppingBag, TriangleAlert } from 'lucide-react'
import type { ProductItem, OrderSelection } from '@/components/ProductModal'
import { toModifierConfig, unitPrice, type PricedOption, type SelectedExtra } from '@/lib/order-modifiers'
import ModifierSection, { Pill } from './ModifierSection'
import QtyStepper from './QtyStepper'

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

const priceHint = (p: number) => (p > 0 ? `+£${p.toFixed(2)}` : 'Free')

export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder }: Props) {
  const [visible, setVisible] = useState(false)
  const [qty, setQty] = useState(1)
  const [spicy, setSpicy] = useState<string | null>(null)
  const [removals, setRemovals] = useState<string[]>([])
  const [additions, setAdditions] = useState<string[]>([])
  const [extras, setExtras] = useState<SelectedExtra[]>([])
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

  const unit = unitPrice(item.price, extras)
  const total = unit * qty
  const extrasSum = unit - item.price
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const soldOut = (name: string) => item.sold_out_extras?.includes(name) ?? false

  const qtyOf = (category: string, name: string) =>
    extras.find((e) => e.category === category && e.name === name)?.qty ?? 0

  // multi mode: qty 0 drops the entry
  const setExtraQty = (category: string, option: PricedOption, next: number) =>
    setExtras((prev) => {
      const rest = prev.filter((e) => !(e.category === category && e.name === option.name))
      return next > 0 ? [...rest, { name: option.name, price: option.price, qty: next, category }] : rest
    })

  // single mode: one per category, tapping the chosen option again clears it
  const pickSingle = (category: string, option: PricedOption) =>
    setExtras((prev) => {
      const rest = prev.filter((e) => e.category !== category)
      const wasPicked = prev.some((e) => e.category === category && e.name === option.name)
      return wasPicked ? rest : [...rest, { name: option.name, price: option.price, qty: 1, category }]
    })

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const handleAdd = () => {
    onAddToOrder({
      item,
      quantity: qty,
      spicy_level: spicy ?? undefined,
      removals,
      additions,
      extras,
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
            {config.spicyLevels.length > 0 && (
              // spicy_level is a single TEXT column, so this stays single-select even if
              // modifier_select_modes says multi.
              <ModifierSection title="Spicy level" subtitle="Choose one, tap again to clear">
                <div className="grid grid-cols-2 gap-2">
                  {config.spicyLevels.map((level) => (
                    <Pill
                      key={level}
                      label={level}
                      selected={spicy === level}
                      onClick={() => setSpicy((s) => (s === level ? null : level))}
                    />
                  ))}
                </div>
              </ModifierSection>
            )}

            {config.ingredients.length > 0 && (
              <ModifierSection title="Ingredients" subtitle="Tap to leave one out">
                <div className="grid grid-cols-2 gap-2">
                  {config.ingredients.map((ing) => {
                    const removed = removals.includes(ing)
                    return (
                      <Pill
                        key={ing}
                        label={ing}
                        hint={removed ? 'Removed' : undefined}
                        tone="danger"
                        selected={removed}
                        onClick={() => setRemovals((prev) => toggle(prev, ing))}
                      />
                    )
                  })}
                </div>
              </ModifierSection>
            )}

            {config.categories.map((cat) => (
              <ModifierSection
                key={cat.key}
                title={cat.label}
                subtitle={cat.mode === 'single' ? 'Choose one, tap again to clear' : 'Add as many as you like'}
              >
                {cat.mode === 'single' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {cat.options.map((opt) => (
                      <Pill
                        key={opt.name}
                        label={opt.name}
                        hint={soldOut(opt.name) ? 'Sold out' : priceHint(opt.price)}
                        selected={qtyOf(cat.key, opt.name) > 0}
                        disabled={soldOut(opt.name)}
                        onClick={() => pickSingle(cat.key, opt)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {cat.options.map((opt) => (
                      <div key={opt.name} className="flex items-center justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${soldOut(opt.name) ? 'text-zinc-400' : 'text-zinc-800'}`}>
                            {opt.name}
                          </p>
                          <p className="text-xs text-zinc-400">{soldOut(opt.name) ? 'Sold out' : priceHint(opt.price)}</p>
                        </div>
                        <QtyStepper
                          value={qtyOf(cat.key, opt.name)}
                          onChange={(next) => setExtraQty(cat.key, opt, next)}
                          label={opt.name}
                          disabled={soldOut(opt.name)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ModifierSection>
            ))}

            {config.additions.length > 0 && (
              <ModifierSection title="Free additions" subtitle="No extra charge">
                <div className="grid grid-cols-2 gap-2">
                  {config.additions.map((add) => (
                    <Pill
                      key={add}
                      label={add}
                      hint={soldOut(add) ? 'Sold out' : 'Free'}
                      selected={additions.includes(add)}
                      disabled={soldOut(add)}
                      onClick={() => setAdditions((prev) => toggle(prev, add))}
                    />
                  ))}
                </div>
              </ModifierSection>
            )}

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
