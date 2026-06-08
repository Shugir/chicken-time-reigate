'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, Minus, ChevronDown, ShoppingBag, Check } from 'lucide-react'
import type { ProductItem, AddOn, OrderSelection } from '@/components/ProductModal'

type DrawerItem = ProductItem & { compare_at_price?: number | null; dietaryFlags?: string[] }

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

export default function ItemCustomizerDrawer({ item, onClose, onAddToOrder }: Props) {
  const [visible, setVisible]         = useState(false)
  const [qty, setQty]                 = useState(1)
  const [removals, setRemovals]       = useState<string[]>([])
  const [extras, setExtras]           = useState<AddOn[]>([])
  const [notes, setNotes]             = useState('')
  const [openSection, setOpenSection] = useState<string | null>(
    (item.add_ons?.length ?? 0) > 0 ? 'extras' : (item.removables?.length ?? 0) > 0 ? 'removals' : null,
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [])

  const extrasTotal = extras.reduce((s, e) => s + e.price, 0)
  const total       = (item.price + extrasTotal) * qty
  const isOffer     = item.compare_at_price != null && item.compare_at_price > item.price
  const hasExtras   = (item.add_ons ?? []).length > 0
  const hasRemovals = (item.removables ?? []).length > 0

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

        {/* Accordion content */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
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
            <div className="flex justify-between text-xs text-zinc-400 mb-2.5">
              <span>Extras added</span>
              <span>+£{extrasTotal.toFixed(2)}</span>
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
