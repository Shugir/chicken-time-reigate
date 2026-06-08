'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, Minus, ChevronDown, ShoppingBag, Check } from 'lucide-react'
import type { ProductItem, AddOn, OrderSelection } from '@/components/ProductModal'

interface ComboItem {
  id: string
  name: string
  price: number
  image_url: string | null
  size_tier: 'regular' | 'large' | null
}

type DrawerItem = ProductItem & {
  compare_at_price?: number | null
  dietaryFlags?: string[]
  combo_category?: 'main' | 'side' | 'drink' | null
}

interface Props {
  item: DrawerItem
  onClose: () => void
  onAddToOrder: (selection: OrderSelection) => void
}

function AccordionSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div>
          <p className="font-heading font-semibold text-zinc-900 text-sm">{title}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-zinc-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

function ComboItemCard({
  item,
  selected,
  onSelect,
}: {
  item: ComboItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border-2 overflow-hidden text-left transition-all ${
        selected ? 'border-brand-red bg-brand-red/5' : 'border-zinc-100 hover:border-zinc-200'
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

export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder }: Props) {
  const [visible, setVisible]         = useState(false)
  const [qty, setQty]                 = useState(1)
  const [removals, setRemovals]       = useState<string[]>([])
  const [extras, setExtras]           = useState<AddOn[]>([])
  const [notes, setNotes]             = useState('')
  const [openSection, setOpenSection] = useState<string | null>(
    (item.add_ons?.length ?? 0) > 0 ? 'extras' : (item.removables?.length ?? 0) > 0 ? 'removals' : null,
  )

  const [mealMode, setMealMode]         = useState(false)
  const [comboLoading, setComboLoading] = useState(false)
  const [comboItems, setComboItems]     = useState<{ sides: ComboItem[]; drinks: ComboItem[] }>({ sides: [], drinks: [] })
  const [selectedSide, setSelectedSide]   = useState<ComboItem | null>(null)
  const [selectedDrink, setSelectedDrink] = useState<ComboItem | null>(null)
  const [comboDiscount, setComboDiscount] = useState(0)

  const isMain = item.combo_category === 'main'

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (!mealMode) return
    setComboLoading(true)
    Promise.all([
      fetch('/api/menu/combo-items?category=side').then(r => r.json()),
      fetch('/api/menu/combo-items?category=drink').then(r => r.json()),
      fetch('/api/menu/combo-discounts?size=medium').then(r => r.json()),
    ])
      .then(([sides, drinks, discounts]) => {
        setComboItems({
          sides:  (sides  as ComboItem[]).filter(i => i.size_tier !== 'large'),
          drinks: (drinks as ComboItem[]).filter(i => i.size_tier !== 'large'),
        })
        const d = Array.isArray(discounts) ? discounts[0] : discounts
        setComboDiscount(Number(d?.discount_amount ?? 0))
      })
      .catch(() => {})
      .finally(() => setComboLoading(false))
  }, [mealMode])

  const extrasTotal = extras.reduce((s, e) => s + e.price, 0)
  const comboAddPrice = mealMode
    ? Math.max(0, (selectedSide?.price ?? 0) + (selectedDrink?.price ?? 0) - comboDiscount)
    : 0
  const total   = (item.price + extrasTotal + comboAddPrice) * qty
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price

  const hasExtras   = (item.add_ons ?? []).length > 0
  const hasRemovals = (item.removables ?? []).length > 0

  const comboBothSelected = mealMode && selectedSide !== null && selectedDrink !== null
  const comboSaving = comboBothSelected ? comboDiscount : 0

  const toggleExtra = (addon: AddOn) => {
    setExtras(prev =>
      prev.some(e => e.name === addon.name)
        ? prev.filter(e => e.name !== addon.name)
        : [...prev, addon],
    )
  }

  const toggleRemoval = (r: string) => {
    setRemovals(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  const handleAdd = () => {
    onAddToOrder({ item, quantity: qty, removals, extras, notes: notes.trim(), totalPrice: total })
    onClose()
  }

  const handleToggleMeal = () => {
    setMealMode(m => !m)
    setSelectedSide(null)
    setSelectedDrink(null)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Hero image */}
        <div className="relative h-56 shrink-0 overflow-hidden bg-zinc-100">
          <Image src={item.image} alt={item.name} fill sizes="448px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
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
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${mealMode ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Combo selectors */}
          {mealMode && (
            <div>
              {comboLoading ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-400">Loading combo items…</div>
              ) : (
                <>
                  <div className="px-5 pt-4 pb-3">
                    <p className="font-heading font-semibold text-zinc-900 text-sm mb-3">
                      Choose Side
                      {selectedSide && <span className="ml-2 text-brand-red text-xs font-normal">✓ {selectedSide.name}</span>}
                    </p>
                    {comboItems.sides.length === 0 ? (
                      <p className="text-xs text-zinc-400">No sides available.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {comboItems.sides.map(side => (
                          <ComboItemCard
                            key={side.id}
                            item={side}
                            selected={selectedSide?.id === side.id}
                            onSelect={() => setSelectedSide(s => s?.id === side.id ? null : side)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-5 pb-4">
                    <p className="font-heading font-semibold text-zinc-900 text-sm mb-3">
                      Choose Drink
                      {selectedDrink && <span className="ml-2 text-brand-red text-xs font-normal">✓ {selectedDrink.name}</span>}
                    </p>
                    {comboItems.drinks.length === 0 ? (
                      <p className="text-xs text-zinc-400">No drinks available.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {comboItems.drinks.map(drink => (
                          <ComboItemCard
                            key={drink.id}
                            item={drink}
                            selected={selectedDrink?.id === drink.id}
                            onSelect={() => setSelectedDrink(d => d?.id === drink.id ? null : drink)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Extras accordion */}
          {hasExtras && (
            <AccordionSection
              title="Add Extras"
              subtitle="Customize with add-ons"
              open={openSection === 'extras'}
              onToggle={() => setOpenSection(s => s === 'extras' ? null : 'extras')}
            >
              <div className="space-y-2">
                {(item.add_ons ?? []).map(addon => {
                  const sel = extras.some(e => e.name === addon.name)
                  return (
                    <button
                      key={addon.name}
                      onClick={() => toggleExtra(addon)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                        sel ? 'border-brand-red bg-brand-red/5' : 'border-zinc-100 hover:border-zinc-200'
                      }`}
                    >
                      <span className={`font-medium text-sm ${sel ? 'text-brand-red' : 'text-zinc-700'}`}>
                        {addon.name}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm font-bold ${sel ? 'text-brand-red' : 'text-zinc-400'}`}>
                          +£{addon.price.toFixed(2)}
                        </span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${sel ? 'border-brand-red bg-brand-red' : 'border-zinc-300'}`}>
                          {sel && <Check size={10} className="text-white" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </AccordionSection>
          )}

          {/* Removals accordion */}
          {hasRemovals && (
            <AccordionSection
              title="Remove Ingredients"
              subtitle="Leave anything out"
              open={openSection === 'removals'}
              onToggle={() => setOpenSection(s => s === 'removals' ? null : 'removals')}
            >
              <div className="flex flex-wrap gap-2">
                {(item.removables ?? []).map(r => {
                  const sel = removals.includes(r)
                  return (
                    <button
                      key={r}
                      onClick={() => toggleRemoval(r)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                        sel
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {sel && <X size={12} />}
                      {r}
                    </button>
                  )
                })}
              </div>
            </AccordionSection>
          )}

          {/* Notes accordion */}
          <AccordionSection
            title="Special Instructions"
            subtitle="Any specific requests?"
            open={openSection === 'notes'}
            onToggle={() => setOpenSection(s => s === 'notes' ? null : 'notes')}
          >
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Extra sauce on the side, no onions…"
              rows={3}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
            />
          </AccordionSection>
        </div>

        {/* Pinned CTA footer */}
        <div className="border-t border-zinc-100 px-5 py-4 bg-white shrink-0">
          {extras.length > 0 && (
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Extras</span>
              <span>+£{extrasTotal.toFixed(2)}</span>
            </div>
          )}
          {comboBothSelected && comboSaving > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 mb-2">
              <span>Combo saving</span>
              <span>−£{comboSaving.toFixed(2)}</span>
            </div>
          )}
          <button
            onClick={handleAdd}
            className="w-full bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all shadow-lg shadow-red-900/20"
          >
            <span className="flex items-center gap-2 text-base">
              <ShoppingBag size={18} />
              Add{qty > 1 ? ` ${qty}×` : ''} to Order
            </span>
            <span className="text-base">£{total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </>
  )
}
