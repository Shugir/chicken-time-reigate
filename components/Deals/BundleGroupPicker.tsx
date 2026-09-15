'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'

interface GroupItem { id: string; name: string; price: number; image_url: string | null }
interface Group { label: string; category: string; pick_qty: number }

interface Props {
  groups: Group[]
  price: number
  menuItemsByCategory: Record<string, GroupItem[]>
  onComplete: (selections: { item_id: string; category: string }[]) => void
}

export default function BundleGroupPicker({ groups, price, menuItemsByCategory, onComplete }: Props) {
  const [selected, setSelected] = useState<Record<number, string[]>>({})

  function toggle(groupIdx: number, itemId: string, pickQty: number) {
    setSelected((prev) => {
      const current = prev[groupIdx] ?? []
      if (current.includes(itemId)) {
        return { ...prev, [groupIdx]: current.filter((id) => id !== itemId) }
      }
      const next = pickQty === 1 ? [itemId] : [...current, itemId].slice(-pickQty)
      return { ...prev, [groupIdx]: next }
    })
  }

  const allComplete = groups.every((g, i) => (selected[i] ?? []).length === g.pick_qty)

  function handleAdd() {
    const selections = groups.flatMap((g, i) => (selected[i] ?? []).map((item_id) => ({ item_id, category: g.category })))
    onComplete(selections)
  }

  return (
    <div className="space-y-5">
      {groups.map((group, i) => {
        const picked = selected[i] ?? []
        const items = menuItemsByCategory[group.category] ?? []
        return (
          <div key={group.label + i}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-heading font-semibold text-zinc-900 text-sm">{group.label}</p>
              <span className="text-[11px] font-semibold text-brand-red">{picked.length} of {group.pick_qty} selected</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const isSelected = picked.includes(item.id)
                const disabled = !isSelected && picked.length >= group.pick_qty
                return (
                  <button
                    key={item.id}
                    disabled={disabled}
                    onClick={() => toggle(i, item.id, group.pick_qty)}
                    className={`rounded-xl border-2 overflow-hidden text-left transition-all ${isSelected ? 'border-brand-red bg-brand-red/5' : disabled ? 'border-zinc-100 opacity-40 cursor-not-allowed' : 'border-zinc-100 hover:border-zinc-200'}`}
                  >
                    {item.image_url ? (
                      <div className="relative w-full h-20">
                        <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="200px" />
                      </div>
                    ) : (
                      <div className="w-full h-20 bg-zinc-100 flex items-center justify-center text-2xl">🍽️</div>
                    )}
                    <div className="p-2.5 flex items-start justify-between gap-1">
                      <p className={`text-xs font-semibold leading-tight ${isSelected ? 'text-brand-red' : 'text-zinc-800'}`}>{item.name}</p>
                      {isSelected && <Check size={13} className="text-brand-red shrink-0 mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        onClick={handleAdd}
        disabled={!allComplete}
        className={`w-full font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-all ${!allComplete ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-brand-red hover:bg-red-700 active:scale-[0.98] text-white shadow-lg shadow-red-900/20'}`}
      >
        <span>{allComplete ? 'Add Bundle to Order' : 'Select all items'}</span>
        {allComplete && <span>£{price.toFixed(2)}</span>}
      </button>
    </div>
  )
}
