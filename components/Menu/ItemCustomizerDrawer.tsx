'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, Minus, ChevronDown, ShoppingBag, Check, TriangleAlert } from 'lucide-react'
import type { ProductItem, AddOn, OrderSelection } from '@/components/ProductModal'
import BundleGroupPicker from '@/components/Deals/BundleGroupPicker'

interface ComboItem {
  id: string
  name: string
  price: number
  image_url: string | null
  size_tier: 'regular' | 'large' | null
}

interface BundleDeal {
  id: string
  name: string
  config: { groups: { label: string; category: string; pick_qty: number }[]; price: number }
}

type DrawerItem = ProductItem & {
  compare_at_price?: number | null
  dietaryFlags?: string[]
  combo_category?: 'main' | 'side' | 'drink' | null
  sold_out_extras?: string[]
}

interface Props {
  item: DrawerItem
  onClose: () => void
  onAddToOrder: (selection: OrderSelection) => void
  onAddBundleItems?: (itemIds: string[]) => void
  initialMealMode?: boolean
}

function AccordionSection({
  title, subtitle, open, onToggle, children, badge,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: string
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-heading font-semibold text-zinc-900 text-sm">{title}</p>
            {badge && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-red">
                <Check size={10} />
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-zinc-400 transition-transform duration-200 shrink-0 ml-3 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function ComboItemCard({ item, selected, onSelect }: { item: ComboItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border-2 overflow-hidden text-left transition-all ${selected ? 'border-brand-red bg-brand-red/5' : 'border-zinc-100 hover:border-zinc-200'
        }`}
    >
      {item.image_url ? (
        <div className="relative w-full h-20">
          <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" />
        </div>
      ) : (
        <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
      )}
      <div className="p-2.5">
        <p className={`text-xs font-semibold leading-tight ${selected ? 'text-brand-red' : 'text-zinc-800'}`}>
          {item.name}
        </p>
        <p className={`text-xs font-bold mt-1 ${selected ? 'text-brand-red' : 'text-zinc-500'}`}>
          £{item.price.toFixed(2)}
        </p>
      </div>
    </button>
  )
}

export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder, onAddBundleItems, initialMealMode = false }: Props) {
  const [visible, setVisible] = useState(false)
  const [qty, setQty] = useState(1)
  const [removals, setRemovals] = useState<string[]>([])
  const [additions, setAdditions] = useState<string[]>([])
  const [extras, setExtras] = useState<AddOn[]>([])
  const [notes, setNotes] = useState('')

  // ponytail: every item can offer "Make it a Meal" now — the bundle lookup itself decides whether a matching deal exists; item-type gating was combo_category-specific and no longer applies
  const isMain = true

  // Meal mode state
  const [mealMode, setMealMode] = useState(isMain && initialMealMode)
  const [matchingBundle, setMatchingBundle] = useState<BundleDeal | null>(null)
  const [bundleMenuItems, setBundleMenuItems] = useState<Record<string, { id: string; name: string; price: number; image_url: string | null }[]>>({})

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
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

  useEffect(() => {
    if (!mealMode) return
    fetch('/api/deals/active')
      .then((r) => r.json())
      .then((deals: { id: string; type: string; name: string; config: any }[]) => {
        const bundle = deals.find((d) => d.type === 'bundle' && d.config.groups.some((g: any) => g.category === item.category)) as BundleDeal | undefined
        if (!bundle) return
        setMatchingBundle(bundle)
        const categories = bundle.config.groups.map((g) => g.category)
        fetch('/api/menu-items')
          .then((r) => r.json())
          .then((all: { id: string; name: string; price: number; image_url: string | null; category: string; is_available: boolean }[]) => {
            const byCategory: Record<string, { id: string; name: string; price: number; image_url: string | null }[]> = {}
            for (const cat of categories) {
              byCategory[cat] = all.filter((m) => m.category === cat && m.is_available)
            }
            setBundleMenuItems(byCategory)
          })
      })
      .catch(() => {})
  }, [mealMode, item.category])

  const extrasTotal = extras.reduce((s, e) => s + e.price, 0)
  const total = (item.price + extrasTotal) * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price

  const hasExtras = (item.add_ons ?? []).length > 0
  const hasRemovals = (item.removables ?? []).length > 0
  const hasAdditions = (item.additions ?? []).length > 0

  // Button validation — bundle selection is now handled entirely by BundleGroupPicker's own CTA,
  // so this footer button no longer has a meal-mode-specific "missing step" to gate on.
  const buttonDisabled = false
  const buttonLabel = `Add${qty > 1 ? ` ${qty}×` : ''} to Order`

  const toggleExtra = (addon: AddOn) => setExtras(prev =>
    prev.some(e => e.name === addon.name) ? prev.filter(e => e.name !== addon.name) : [...prev, addon])
  const toggleRemoval = (r: string) => setRemovals(prev =>
    prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  const toggleAddition = (a: string) => setAdditions(prev =>
    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const handleAdd = () => {
    onAddToOrder({ item, quantity: qty, removals, additions, extras, notes: notes.trim(), totalPrice: total })
    onClose()
  }

  const handleToggleMeal = () => {
    setMealMode((m) => !m)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Popup Modal Container */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={item.name}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto transition-all duration-200 ${
            visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
          }`}
        >
          {/* Hero image */}
          <div className="relative h-52 sm:h-56 shrink-0 overflow-hidden bg-zinc-100">
            <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 100vw, 512px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors z-20"
            >
              <X size={16} />
            </button>
          {isOffer && (
            <div className="absolute top-0 right-14 bg-brand-red text-white text-[11px] font-black px-3 py-1.5 rounded-b-xl flex items-center gap-1 shadow-lg">
              🔥 OFFER
            </div>
          )}
          <div className="absolute bottom-4 left-5 right-14">
            <h2 className="font-heading font-black text-xl text-white leading-tight">{item.name}</h2>
            <p className="text-white/70 text-sm mt-1 line-clamp-2">{item.description}</p>
            {item.allergens && item.allergens.length > 0 && (
              <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 text-xs font-medium w-fit">
                <TriangleAlert size={11} className="shrink-0" />
                Contains: {item.allergens.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Price & qty row */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div>
            {isOffer && (
              <span className="text-sm text-zinc-400 line-through mr-2">
                £{(item.compare_at_price!).toFixed(2)}
              </span>
            )}
            <span className={`text-2xl font-heading font-black ${isOffer ? 'text-brand-red' : 'text-zinc-900'}`}>
              £{item.price.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full border-2 border-zinc-200 flex items-center justify-center hover:border-zinc-900 transition-colors text-zinc-700"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-bold text-lg text-zinc-900">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">

          {/* Make it a Meal toggle */}
          {isMain && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between bg-zinc-50 rounded-2xl px-4 py-3.5 border border-zinc-100">
                <div>
                  <p className="font-heading font-semibold text-zinc-900 text-sm">Make it a Meal</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Add side &amp; drink at combo price</p>
                </div>
                <button
                  onClick={handleToggleMeal}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${mealMode ? 'bg-brand-red' : 'bg-zinc-300'}`}
                  aria-pressed={mealMode}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${mealMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}

          {/* Bundle group picker — replaces old size/side/drink combo accordion */}
          {mealMode && (
            matchingBundle ? (
              <div className="px-5 py-4">
                <BundleGroupPicker
                  groups={matchingBundle.config.groups}
                  price={matchingBundle.config.price}
                  menuItemsByCategory={bundleMenuItems}
                  onComplete={(selections) => {
                    onAddToOrder({ item, quantity: qty, removals, additions, extras, notes: notes.trim(), totalPrice: total })
                    onAddBundleItems?.(selections.map((s) => s.item_id))
                    onClose()
                  }}
                />
              </div>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-zinc-400">No meal deal currently available for this item.</div>
            )
          )}

          {/* Customise — removals + additions, flat 2-col grid */}
          {(hasRemovals || hasAdditions) && (
            <div className="px-5 py-4">
              <p className="font-heading font-semibold text-zinc-900 text-sm mb-3">Customise</p>
              <div className="grid grid-cols-2 gap-2">
                {(item.removables ?? []).map(r => {
                  const sel = removals.includes(r)
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRemoval(r)}
                      className={`text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${sel ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                    >
                      <p className={`font-semibold text-sm ${sel ? 'text-white' : 'text-zinc-800'}`}>{r}</p>
                      <p className={`text-xs ${sel ? 'text-white/70' : 'text-zinc-400'}`}>Free</p>
                    </button>
                  )
                })}
                {(item.additions ?? []).map(a => {
                  const sel = additions.includes(a)
                  return (
                    <button
                      key={a}
                      onClick={() => toggleAddition(a)}
                      className={`text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${sel ? 'border-brand-red bg-brand-red' : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                    >
                      <p className={`font-semibold text-sm ${sel ? 'text-white' : 'text-zinc-800'}`}>{a}</p>
                      <p className={`text-xs ${sel ? 'text-white/70' : 'text-zinc-400'}`}>Free</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add-ons — flat 2-col grid */}
          {hasExtras && (
            <div className="px-5 py-4">
              <p className="font-heading font-semibold text-zinc-900 text-sm mb-3">Add-ons</p>
              <div className="grid grid-cols-2 gap-2">
                {(item.add_ons ?? []).map(addon => {
                  const addonSoldOut = item.sold_out_extras?.includes(addon.name) ?? false
                  const sel = !addonSoldOut && extras.some(e => e.name === addon.name)
                  return (
                    <button
                      key={addon.name}
                      onClick={() => !addonSoldOut && toggleExtra(addon)}
                      disabled={addonSoldOut}
                      className={`text-left px-3.5 py-2.5 rounded-xl border-2 transition-all ${addonSoldOut ? 'border-zinc-100 opacity-50 cursor-not-allowed' : sel ? 'border-brand-red bg-brand-red/5' : 'border-zinc-200 hover:border-zinc-400'}`}
                    >
                      <p className={`font-semibold text-sm ${addonSoldOut ? 'text-zinc-400' : sel ? 'text-brand-red' : 'text-zinc-800'}`}>{addon.name}</p>
                      <p className={`text-xs ${addonSoldOut ? 'text-zinc-400' : sel ? 'text-brand-red/70' : 'text-zinc-400'}`}>
                        {addonSoldOut ? 'Sold Out' : addon.price > 0 ? `+£${addon.price.toFixed(2)}` : 'Free'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Special instructions — flat */}
          <div className="px-5 py-4">
            <p className="font-heading font-semibold text-zinc-900 text-sm mb-3">Special Instructions</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Extra sauce on the side, no onions…"
              rows={3}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
            />
          </div>
        </div>

        {/* Pinned CTA footer */}
        <div className="border-t border-zinc-100 px-5 py-4 bg-white shrink-0">
          {extras.length > 0 && (
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Extras</span><span>+£{extrasTotal.toFixed(2)}</span>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={buttonDisabled}
            className={`w-full font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${buttonDisabled
              ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'
              }`}
          >
            <span className="flex items-center gap-2 text-base">
              <ShoppingBag size={18} />
              {buttonLabel}
            </span>
            {!buttonDisabled && <span className="text-base">£{total.toFixed(2)}</span>}
          </button>
        </div>
        </div>
      </div>
    </>
  )
}
