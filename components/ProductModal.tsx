'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ChevronDown, Plus, Minus, ShoppingBag, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemCategory = string

export interface AddOn {
  name: string
  price: number
}

export interface ProductItem {
  id: string
  name: string
  description: string
  price: number
  category: ItemCategory
  badge?: string
  emoji: string
  image: string
  allergens: string[]
  removables: string[]
  add_ons: AddOn[]
}

export interface OrderSelection {
  item: ProductItem
  quantity: number
  removals: string[]
  extras: AddOn[]
  notes: string
  totalPrice: number
}

// ─── Static lookups ───────────────────────────────────────────────────────────

const ALLERGEN_DETAILS: Record<string, string> = {
  Gluten:  'Contains wheat flour in the crispy coating.',
  Dairy:   'Present in sauces, dips, and brioche bun.',
  Eggs:    'Used in marinades and coatings.',
  Soya:    'May contain soya-based oils.',
  Sesame:  'Sesame seeds used as garnish on selected items.',
  Nuts:    'Manufactured in a facility that handles tree nuts.',
  Celery:  'May be present in spice blends.',
  Mustard: 'Used in some dressings and marinades.',
}

const CATEGORY_GRADIENT: Record<ItemCategory, string> = {
  deals:   'from-red-100 via-orange-50 to-amber-50',
  burgers: 'from-orange-100 via-amber-50 to-yellow-50',
  chicken: 'from-red-100 via-orange-50 to-amber-50',
  sides:   'from-yellow-100 via-lime-50 to-green-50',
  drinks:  'from-sky-100 via-blue-50 to-indigo-50',
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-1 ${
        active ? 'bg-brand-red' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ─── Allergy accordion ────────────────────────────────────────────────────────

function AllergyAccordion({ allergens }: { allergens: string[] }) {
  const [open, setOpen] = useState(false)

  if (!allergens?.length) return null

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <AlertCircle size={17} className="text-amber-500 shrink-0" />
          <span className="font-semibold text-sm text-gray-800">Allergy Advice</span>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {allergens.length}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Always inform our team of any allergies before ordering. Dishes are prepared in a shared kitchen.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allergens.map((name) => (
              <div key={name} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-amber-800">{name}</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                  {ALLERGEN_DETAILS[name] ?? 'May be present in this dish.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Product modal ────────────────────────────────────────────────────────────

interface ProductModalProps {
  item: ProductItem
  onClose: () => void
  onAddToOrder: (selection: OrderSelection) => void
}

export function ProductModal({ item, onClose, onAddToOrder }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [removals, setRemovals] = useState<Set<string>>(new Set())
  const [extras,   setExtras]   = useState<Set<string>>(new Set())
  const [notes,    setNotes]    = useState('')

  function toggleRemoval(label: string) {
    setRemovals((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function toggleExtra(name: string) {
    setExtras((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const selectedAddOns = (item.add_ons ?? []).filter((a) => extras.has(a.name))
  const extrasTotal    = selectedAddOns.reduce((sum, a) => sum + a.price, 0)
  const unitPrice      = item.price + extrasTotal
  const totalPrice     = unitPrice * quantity

  function handleAdd() {
    onAddToOrder({
      item,
      quantity,
      removals: [...removals],
      extras:   selectedAddOns,
      notes:    notes.trim(),
      totalPrice,
    })
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} aria-hidden />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal
        aria-label={item.name}
        className="fixed z-50 bottom-0 left-0 right-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4"
      >
        <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92dvh] md:max-h-[85vh] shadow-2xl">

          {/* ── 1. Hero image area ── */}
          <div className="relative flex-none h-56 overflow-hidden bg-gray-900">
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, 512px"
              className="object-cover"
              priority
            />
            {/* Bottom gradient so product name text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md transition-colors z-10"
              aria-label="Close"
            >
              <X size={18} className="text-white" />
            </button>
            {item.badge && (
              <span className="absolute top-4 left-4 z-10 bg-brand-red text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                {item.badge}
              </span>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">

            {/* Title + description */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading font-black text-xl text-brand-dark leading-tight">{item.name}</h2>
                <span className="shrink-0 font-bold text-lg text-brand-dark">£{item.price.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{item.description}</p>
            </div>

            {/* ── 2. Allergy accordion — driven by item.allergens ── */}
            <AllergyAccordion allergens={item.allergens} />

            {/* ── 3. Customise — driven by item.removables ── */}
            {(item.removables ?? []).length > 0 && (
              <div className="border-t border-gray-100 px-5 py-5">
                <h3 className="font-heading font-bold text-base text-brand-dark mb-1">Customise Your Order</h3>
                <p className="text-xs text-gray-400 mb-4">Toggle to remove an ingredient</p>
                <div className="space-y-3">
                  {(item.removables ?? []).map((label) => {
                    const active = removals.has(label)
                    return (
                      <div key={label} className="flex items-center justify-between">
                        <span className={`text-sm font-medium transition-colors ${active ? 'text-brand-red line-through' : 'text-gray-700'}`}>
                          {label}
                        </span>
                        <Toggle active={active} onChange={() => toggleRemoval(label)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 4. Add extras — driven by item.add_ons ── */}
            {(item.add_ons ?? []).length > 0 && (
              <div className="border-t border-gray-100 px-5 py-5">
                <h3 className="font-heading font-bold text-base text-brand-dark mb-1">Add Extras</h3>
                <p className="text-xs text-gray-400 mb-4">Upgrade your meal</p>
                <div className="space-y-2">
                  {(item.add_ons ?? []).map((addon) => {
                    const selected = extras.has(addon.name)
                    return (
                      <button
                        key={addon.name}
                        onClick={() => toggleExtra(addon.name)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-150 text-left ${
                          selected ? 'border-brand-red bg-red-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'border-brand-red bg-brand-red' : 'border-gray-300'
                          }`}>
                            {selected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className={`text-sm font-semibold ${selected ? 'text-brand-dark' : 'text-gray-700'}`}>
                            {addon.name}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${selected ? 'text-brand-red' : 'text-gray-500'}`}>
                          +£{addon.price.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 5. Special Instructions ── */}
            <div className="border-t border-gray-100 px-5 py-5">
              <h3 className="font-heading font-bold text-base text-brand-dark mb-1">Special Instructions</h3>
              <p className="text-xs text-gray-400 mb-3">Allergies, preferences, or any other requests</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Extra crispy, sauce on the side, no salt…"
                rows={3}
                maxLength={200}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red/50 transition-colors"
              />
              {notes.length > 0 && (
                <p className="text-right text-xs text-gray-400 mt-1">{notes.length}/200</p>
              )}
            </div>

            <div className="h-2" />
          </div>

          {/* ── 6. Sticky bottom bar ── */}
          <div className="flex-none border-t border-gray-100 bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
            {extrasTotal > 0 && (
              <div className="flex justify-between text-xs text-gray-500 mb-3">
                <span>£{item.price.toFixed(2)} + £{extrasTotal.toFixed(2)} extras</span>
                <span className="font-semibold text-gray-700">£{unitPrice.toFixed(2)} each</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity === 1}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center text-base font-black text-brand-dark" aria-live="polite">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm transition-all"
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={handleAdd}
                className="flex-1 flex items-center justify-between bg-brand-red hover:bg-red-700 active:bg-red-800 text-white font-black text-base px-5 py-3.5 rounded-xl transition-colors shadow-lg shadow-red-500/25"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} />
                  <span>Add to Order</span>
                </div>
                <span className="bg-red-800/40 px-3 py-1 rounded-lg text-sm font-bold">
                  £{totalPrice.toFixed(2)}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
