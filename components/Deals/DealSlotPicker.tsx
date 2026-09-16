'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, X } from 'lucide-react'
import ItemCustomizerDrawer from '@/components/Menu/ItemCustomizerDrawer'
import type { OrderSelection } from '@/components/ProductModal'
import { slotQty, isSelectionComplete } from './deal-slot-picker-logic'

// ItemCustomizerDrawer renders <Image src={item.image}> unconditionally, and next/image
// throws on an empty src — so a slot item with no image_url needs a real URL, not ''.
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80'

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

interface Group { label: string; min_qty: number; max_qty: number; item_ids: string[] }

interface Deal {
  id: string
  name: string
  config: { groups: Group[]; price: number }
}

interface Props {
  deal: Deal
  itemsById: Map<string, SlotItem>
  onClose: () => void
  onComplete: (picks: Pick[]) => void
}

function isCustomizable(item: SlotItem): boolean {
  return Boolean(item.extras?.length || item.removals?.length || item.additions?.length)
}

export default function DealSlotPicker({ deal, itemsById, onClose, onComplete }: Props) {
  // picks[groupIndex] is a list of Pick entries for that slot
  const [picks, setPicks] = useState<Record<number, Pick[]>>({})
  const [customizing, setCustomizing] = useState<{ groupIndex: number; item: SlotItem } | null>(null)

  function slotCount(groupIndex: number): number {
    return slotQty(picks[groupIndex] ?? [])
  }

  function addPlainPick(groupIndex: number, item: SlotItem) {
    setPicks((prev) => {
      const current = prev[groupIndex] ?? []
      const existing = current.find((p) => p.item_id === item.id)
      const next = existing
        ? current.map((p) => (p.item_id === item.id ? { ...p, qty: p.qty + 1 } : p))
        : [...current, { item_id: item.id, qty: 1, removals: [], additions: [], extras: [] }]
      return { ...prev, [groupIndex]: next }
    })
  }

  function removePick(groupIndex: number, item_id: string) {
    setPicks((prev) => {
      const current = prev[groupIndex] ?? []
      const existing = current.find((p) => p.item_id === item_id)
      if (!existing) return prev
      const next = existing.qty > 1
        ? current.map((p) => (p.item_id === item_id ? { ...p, qty: p.qty - 1 } : p))
        : current.filter((p) => p !== existing)
      return { ...prev, [groupIndex]: next }
    })
  }

  function handlePillClick(groupIndex: number, item: SlotItem) {
    if (slotCount(groupIndex) >= deal.config.groups[groupIndex].max_qty) return
    if (isCustomizable(item)) {
      setCustomizing({ groupIndex, item })
      return
    }
    addPlainPick(groupIndex, item)
  }

  function handleCustomizerAdd(selection: OrderSelection) {
    if (!customizing) return
    const { groupIndex, item } = customizing
    const entry: Pick = {
      item_id: item.id,
      qty: selection.quantity,
      removals: selection.removals,
      additions: selection.additions ?? [],
      extras: selection.extras,
    }
    setPicks((prev) => ({ ...prev, [groupIndex]: [...(prev[groupIndex] ?? []), entry] }))
    setCustomizing(null)
  }

  const allComplete = isSelectionComplete(deal.config.groups, picks)

  function handleSubmit() {
    onComplete(Object.values(picks).flat())
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-heading font-black text-xl text-zinc-900">{deal.name}</p>
            <p className="text-sm text-zinc-400">£{deal.config.price.toFixed(2)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-900"><X size={20} /></button>
        </div>

        <div className="space-y-5">
          {deal.config.groups.map((group, gi) => {
            const count = slotCount(gi)
            return (
              <div key={gi}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-heading font-semibold text-zinc-900 text-sm">{group.label}</p>
                  <span className="text-[11px] font-semibold text-brand-red">
                    {count} of {group.min_qty === group.max_qty ? group.min_qty : `${group.min_qty}-${group.max_qty}`} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.item_ids.map((id) => {
                    const item = itemsById.get(id)
                    if (!item) return null
                    const pickedQty = (picks[gi] ?? []).filter((p) => p.item_id === id).reduce((s, p) => s + p.qty, 0)
                    const atMax = count >= group.max_qty && pickedQty === 0
                    return (
                      <div key={id} className={`rounded-xl border-2 overflow-hidden text-left ${pickedQty > 0 ? 'border-brand-red bg-brand-red/5' : atMax ? 'border-zinc-100 opacity-40' : 'border-zinc-100'}`}>
                        <button
                          onClick={() => handlePillClick(gi, item)}
                          disabled={atMax}
                          className="w-full text-left"
                        >
                          {item.image_url ? (
                            <div className="relative w-full h-20">
                              <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" />
                            </div>
                          ) : (
                            <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
                          )}
                          <div className="p-2.5 flex items-start justify-between gap-1">
                            <p className={`text-xs font-semibold leading-tight ${pickedQty > 0 ? 'text-brand-red' : 'text-zinc-800'}`}>{item.name}</p>
                            {pickedQty > 0 && <Check size={13} className="text-brand-red shrink-0 mt-0.5" />}
                          </div>
                        </button>
                        {pickedQty > 0 && (
                          <div className="flex items-center justify-between px-2.5 pb-2">
                            <button onClick={() => removePick(gi, id)} aria-label={`Remove one ${item.name}`} className="w-6 h-6 rounded-full border border-zinc-300 text-zinc-600 text-sm">−</button>
                            <span className="text-xs font-bold text-zinc-900">{pickedQty}</span>
                            <button onClick={() => handlePillClick(gi, item)} disabled={count >= group.max_qty} aria-label={`Add another ${item.name}`} className="w-6 h-6 rounded-full border border-zinc-300 text-zinc-600 text-sm disabled:opacity-30">+</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allComplete}
          className={`w-full mt-6 font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${!allComplete ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'}`}
        >
          <span>{allComplete ? 'Add Bundle to Order' : 'Select required items'}</span>
          {allComplete && <span>£{deal.config.price.toFixed(2)}</span>}
        </button>
      </div>

      {customizing && (
        <ItemCustomizerDrawer
          item={{
            id: customizing.item.id,
            name: customizing.item.name,
            description: '',
            price: customizing.item.price,
            category: customizing.item.category,
            emoji: '🍽️',
            image: customizing.item.image_url || FALLBACK_IMG,
            allergens: [],
            removables: customizing.item.removals ?? [],
            additions: customizing.item.additions ?? [],
            add_ons: customizing.item.extras ?? [],
          }}
          onClose={() => setCustomizing(null)}
          onAddToOrder={handleCustomizerAdd}
        />
      )}
    </div>
  )
}
