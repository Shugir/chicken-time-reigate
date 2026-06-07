'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart, Check } from 'lucide-react'

interface ComboItem {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  size_tier: 'regular' | 'large' | null
}

interface ComboDiscount {
  id: string
  meal_size: string
  name: string
  discount_amount: number
}

interface ComboComponent {
  id: string
  name: string
  category: 'main' | 'side' | 'drink'
  size_tier: 'regular' | 'large'
}

interface StoredCartItem {
  name: string
  price: number
  quantity: number
  totalPrice: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
  combo_components?: ComboComponent[]
}

type MealSize = 'medium' | 'large'
type Step = 1 | 2 | 3 | 4

interface Selection {
  size: MealSize | null
  main: ComboItem | null
  side: ComboItem | null
  drink: ComboItem | null
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Size',
  2: 'Main',
  3: 'Side',
  4: 'Drink',
}

export default function ComboBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [sel, setSel] = useState<Selection>({ size: null, main: null, side: null, drink: null })
  const [allItems, setAllItems] = useState<{ main: ComboItem[]; side: ComboItem[]; drink: ComboItem[] }>({
    main: [], side: [], drink: [],
  })
  const [discount, setDiscount] = useState<ComboDiscount | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/menu/combo-items?category=main').then(r => r.json()),
      fetch('/api/menu/combo-items?category=side').then(r => r.json()),
      fetch('/api/menu/combo-items?category=drink').then(r => r.json()),
    ]).then(([main, side, drink]) => {
      setAllItems({ main, side, drink })
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!sel.size) return
    fetch(`/api/menu/combo-discounts?size=${sel.size}`)
      .then(r => r.json())
      .then(setDiscount)
  }, [sel.size])

  const filteredSides = (): ComboItem[] => {
    if (!sel.size) return allItems.side
    if (sel.size === 'medium') return allItems.side.filter(i => i.size_tier !== 'large')
    if (sel.drink?.size_tier === 'large') return allItems.side.filter(i => i.size_tier !== 'large')
    return allItems.side
  }

  const filteredDrinks = (): ComboItem[] => {
    if (!sel.size) return allItems.drink
    if (sel.size === 'medium') return allItems.drink.filter(i => i.size_tier !== 'large')
    if (sel.side?.size_tier === 'large') return allItems.drink.filter(i => i.size_tier !== 'large')
    return allItems.drink
  }

  const liveTotal = (): number | null => {
    if (!sel.main || !sel.side || !sel.drink) return null
    return Math.max(0, sel.main.price + sel.side.price + sel.drink.price - (discount?.discount_amount ?? 0))
  }

  const pickSize = (size: MealSize) => {
    setSel({ size, main: null, side: null, drink: null })
    setStep(2)
  }

  const pickMain = (item: ComboItem) => {
    setSel(s => ({ ...s, main: item }))
    setStep(3)
  }

  const pickSide = (item: ComboItem) => {
    const mustClearDrink = sel.size === 'large' && item.size_tier === 'large' && sel.drink?.size_tier === 'large'
    setSel(s => ({ ...s, side: item, drink: mustClearDrink ? null : s.drink }))
    setStep(4)
  }

  const pickDrink = (item: ComboItem) => {
    const mustClearSide = sel.size === 'large' && item.size_tier === 'large' && sel.side?.size_tier === 'large'
    if (mustClearSide) {
      setSel(s => ({ ...s, drink: item, side: null }))
      setStep(3)
    } else {
      setSel(s => ({ ...s, drink: item }))
    }
  }

  const handleAddToCart = () => {
    if (!sel.main || !sel.side || !sel.drink || !sel.size) return
    const total = liveTotal()
    if (total === null) return
    setAdding(true)

    const comboItem: StoredCartItem = {
      name:       `${sel.size === 'large' ? 'Large' : 'Medium'} Combo Meal`,
      price:      total,
      quantity:   1,
      totalPrice: total,
      extras:     [],
      removals:   [],
      notes:      null,
      combo_components: [
        { id: sel.main.id,  name: sel.main.name,  category: 'main',  size_tier: sel.main.size_tier  ?? 'regular' },
        { id: sel.side.id,  name: sel.side.name,  category: 'side',  size_tier: sel.side.size_tier  ?? 'regular' },
        { id: sel.drink.id, name: sel.drink.name, category: 'drink', size_tier: sel.drink.size_tier ?? 'regular' },
      ],
    }

    try {
      const existing: StoredCartItem[] = JSON.parse(sessionStorage.getItem('pendingCart') ?? '[]')
      existing.push(comboItem)
      sessionStorage.setItem('pendingCart', JSON.stringify(existing))
    } catch {
      // sessionStorage blocked
    }

    router.push('/checkout')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading menu...</div>
      </div>
    )
  }

  const total = liveTotal()

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <div className="border-b border-zinc-800 px-4 py-4 sticky top-0 bg-zinc-950 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Build Your Meal</h1>
        </div>
      </div>

      <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-950">
        <div className="max-w-2xl mx-auto flex items-center gap-1">
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => s < step ? setStep(s) : undefined}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  s < step
                    ? 'bg-brand-red text-white cursor-pointer hover:bg-brand-red/80'
                    : s === step
                    ? 'bg-brand-red text-white'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {s < step ? <Check className="h-3.5 w-3.5" /> : s}
              </button>
              <span className={`text-xs hidden sm:inline-block mr-1 ${s === step ? 'text-white font-medium' : 'text-zinc-600'}`}>
                {STEP_LABELS[s]}
              </span>
              {s < 4 && <ChevronRight className="h-3 w-3 text-zinc-700 mr-1" />}
            </div>
          ))}
        </div>
      </div>

      {sel.size && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div className="text-xs text-zinc-500 truncate">
              {[sel.main?.name, sel.side?.name, sel.drink?.name].filter(Boolean).join(' · ')}
            </div>
            <div className="text-right shrink-0">
              {total !== null ? (
                <div className="flex items-center gap-2">
                  {discount && discount.discount_amount > 0 && (
                    <span className="text-emerald-400 text-xs">−£{Number(discount.discount_amount).toFixed(2)}</span>
                  )}
                  <span className="text-brand-red font-bold">£{total.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-zinc-600 text-xs">Select all 3 items</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Choose your meal size</h2>
            <div className="grid grid-cols-2 gap-4">
              {(['medium', 'large'] as MealSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => pickSize(size)}
                  className="bg-zinc-900 border-2 border-zinc-700 hover:border-brand-red rounded-xl p-6 text-center transition-all group"
                >
                  <div className="text-3xl mb-3">{size === 'large' ? '🍗' : '🐣'}</div>
                  <div className="text-base font-bold capitalize group-hover:text-brand-red transition-colors">{size}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {size === 'medium' ? 'Regular items only' : 'Regular or large items'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Choose your main</h2>
            <ItemGrid items={allItems.main} selected={sel.main} onSelect={pickMain} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Choose your side</h2>
            {sel.size === 'medium' && <p className="text-xs text-zinc-500 mb-4">Medium meal — regular only</p>}
            {sel.size === 'large' && sel.drink?.size_tier === 'large' && (
              <p className="text-xs text-amber-400 mb-4">Large drink selected — side must be regular</p>
            )}
            <ItemGrid items={filteredSides()} selected={sel.side} onSelect={pickSide} />
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Choose your drink</h2>
            {sel.size === 'medium' && <p className="text-xs text-zinc-500 mb-4">Medium meal — regular only</p>}
            {sel.size === 'large' && sel.side?.size_tier === 'large' && (
              <p className="text-xs text-amber-400 mb-4">Large side selected — drink must be regular</p>
            )}
            <ItemGrid items={filteredDrinks()} selected={sel.drink} onSelect={pickDrink} />

            {sel.drink && (
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleAddToCart}
                  disabled={adding || total === null}
                  className="w-full bg-brand-red hover:bg-brand-red/80 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {adding ? 'Adding...' : `Add to Cart${total !== null ? ` · £${total.toFixed(2)}` : ''}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ItemGrid({
  items,
  selected,
  onSelect,
}: {
  items: ComboItem[]
  selected: ComboItem | null
  onSelect: (item: ComboItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-600 text-sm">
        No items available.
        <br />
        Tag items in the{' '}
        <a href="/admin" className="text-brand-red hover:underline">Menu Manager</a>{' '}
        with a Combo Role.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(item => {
        const active = selected?.id === item.id
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
              active ? 'border-brand-red bg-brand-red/5' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            {item.image_url ? (
              <div className="relative w-full h-28">
                <Image src={item.image_url} alt={item.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-full h-28 bg-zinc-800 flex items-center justify-center text-3xl">🍗</div>
            )}
            <div className="p-3">
              <div className="text-sm font-medium leading-tight text-white">{item.name}</div>
              {item.size_tier && (
                <div className="text-xs text-zinc-500 mt-0.5 capitalize">{item.size_tier}</div>
              )}
              <div className="text-brand-red font-semibold text-sm mt-1.5">
                £{Number(item.price).toFixed(2)}
              </div>
            </div>
            {active && (
              <div className="absolute top-2 right-2 bg-brand-red rounded-full p-0.5 shadow">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
