'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { ProductModal, OrderSelection, AddOn } from '../../components/ProductModal'
import DealSlotPicker from '@/components/Deals/DealSlotPicker'
import ScrollToTop from '@/components/UI/ScrollToTop'
import { inSlot } from '@/lib/deal-engine'
import { addToLines, changeLineQty, itemIdOfKey, itemQty, removeOneFromItem } from '@/lib/cart-lines'
import { formatExtra, hasNoCustomization, type ModifierConfig } from '@/lib/order-modifiers'
import { dbToMenuItem, FALLBACK_IMG, itemConfig, lineUnitPrice, type DbMenuItem, type MenuItem } from '@/lib/menu-items'
import { useCart } from '@/lib/use-cart'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartEntry { qty: number; spicy_level?: string; removals: string[]; additions: string[]; extras: AddOn[]; notes?: string }
type Cart = Record<string, CartEntry>

interface DbCategory {
  id: string; name: string; slug: string; sort_order: number
  image_url: string | null; description: string | null
}

interface ActiveDeal { id: string; type: string; name: string; config: any }

interface BundleDeal {
  id: string
  name: string
  config: {
    groups: { label: string; min_qty: number; max_qty: number; item_ids?: string[]; category?: string }[]
    price: number
    price_type?: 'fixed' | 'percent'
    discount_percent?: number
  }
}

interface SlotItem {
  id: string
  name: string
  price: number
  image_url: string | null
  category: string
  extras: AddOn[] | null
  removals: string[] | null
  additions: string[] | null
  modifiers?: ModifierConfig
}


const MENU_ITEMS: MenuItem[] = [
  {
    id: 'deal1', category: 'deals', emoji: '🎉', badge: 'Deal',
    name: 'Burger Meal Deal', price: 12.99,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
    description: 'Classic Chicken Burger + Crinkle Cut Fries + any drink',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya'],
    removables: [],
    add_ons: [{ name: 'Upgrade to Loaded Fries', price: 2.00 }],
  },
  {
    id: 'deal2', category: 'deals', emoji: '🍗', badge: 'Deal',
    name: 'Wing Box Deal', price: 15.99,
    image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=500&q=80',
    description: '8pc Korean Glaze Wings + Loaded Fries + any drink',
    allergens: ['Sesame', 'Soya', 'Eggs', 'Gluten', 'Dairy'],
    removables: [],
    add_ons: [],
  },
  {
    id: 'deal3', category: 'deals', emoji: '👨‍👩‍👧', badge: 'Deal',
    name: 'Family Feast', price: 29.99,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80',
    description: '2 Burgers + 8pc Wings + 2 Loaded Fries + 4 Drinks',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya', 'Sesame'],
    removables: [],
    add_ons: [],
  },
  {
    id: 'b1', category: 'burgers', emoji: '🍔',
    name: 'Classic Chicken Burger', price: 8.99,
    image: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=500&q=80',
    description: 'Crispy fried chicken breast, lettuce, tomato, mayo on a brioche bun',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya', 'Sesame'],
    removables: ['No Lettuce', 'No Tomato', 'No Mayo'],
    add_ons: [{ name: 'Add Cheese', price: 0.75 }, { name: 'Add Bacon', price: 1.50 }],
  },
  {
    id: 'b2', category: 'burgers', emoji: '🍔', badge: 'Hot',
    name: 'Spicy Double Stack', price: 11.49,
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80',
    description: 'Two spicy crispy fillets, jalapeños, pepper jack, chipotle sauce',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya', 'Mustard'],
    removables: ['No Jalapeños', 'No Cheese', 'No Chipotle Sauce'],
    add_ons: [{ name: 'Extra Patty', price: 2.50 }, { name: 'Add Bacon', price: 1.50 }],
  },
  {
    id: 'b3', category: 'burgers', emoji: '🍔',
    name: 'BBQ Crunch Burger', price: 10.49,
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=500&q=80',
    description: 'Crispy chicken thigh, streaky bacon, BBQ sauce, crispy onions',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya', 'Celery', 'Mustard'],
    removables: ['No Bacon', 'No BBQ Sauce', 'No Crispy Onions'],
    add_ons: [{ name: 'Add Cheese', price: 0.75 }, { name: 'Extra Patty', price: 2.50 }],
  },
  {
    id: 'b4', category: 'burgers', emoji: '🍔', badge: 'New',
    name: 'Zinger Deluxe', price: 9.99,
    image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500&q=80',
    description: 'Spiced crispy fillet, caramelised onions, gherkins, garlic aioli',
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Soya', 'Mustard'],
    removables: ['No Gherkins', 'No Caramelised Onions', 'No Garlic Aioli'],
    add_ons: [{ name: 'Add Cheese', price: 0.75 }, { name: 'Add Bacon', price: 1.50 }],
  },
  {
    id: 'w1', category: 'chicken', emoji: '🍗',
    name: 'Buffalo Wings (6pc)', price: 7.99,
    image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&q=80',
    description: 'Classic buffalo sauce, blue cheese dip, celery sticks',
    allergens: ['Dairy', 'Eggs', 'Celery', 'Mustard'],
    removables: ['No Blue Cheese Dip', 'No Celery Sticks'],
    add_ons: [{ name: 'Extra Dip', price: 0.75 }, { name: 'Extra Wings +2pc', price: 2.50 }],
  },
  {
    id: 'w2', category: 'chicken', emoji: '🍗', badge: 'Popular',
    name: 'Korean Glaze Wings (8pc)', price: 10.99,
    image: 'https://images.unsplash.com/photo-1606728035253-49e8a23146de?w=500&q=80',
    description: 'Gochujang & honey glaze, sesame, spring onion',
    allergens: ['Sesame', 'Soya', 'Eggs'],
    removables: ['No Spring Onion', 'No Sesame'],
    add_ons: [{ name: 'Extra Dip', price: 0.75 }, { name: 'Extra Wings +2pc', price: 2.50 }],
  },
  {
    id: 'w3', category: 'chicken', emoji: '🍗',
    name: 'Honey Garlic Wings (6pc)', price: 8.49,
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500&q=80',
    description: 'Sweet honey garlic sauce, toasted sesame seeds',
    allergens: ['Sesame', 'Soya', 'Eggs'],
    removables: ['No Sesame', 'No Garlic Sauce'],
    add_ons: [{ name: 'Extra Dip', price: 0.75 }, { name: 'Extra Wings +2pc', price: 2.50 }],
  },
  {
    id: 'w4', category: 'chicken', emoji: '🍗',
    name: 'Naked Wings (10pc)', price: 11.99,
    image: 'https://images.unsplash.com/photo-1598514982901-3daa2a0a7d49?w=500&q=80',
    description: 'Plain crispy wings with your choice of dipping sauce',
    allergens: ['Eggs', 'Soya'],
    removables: [],
    add_ons: [
      { name: 'Add Buffalo Dip', price: 0.75 },
      { name: 'Add Blue Cheese Dip', price: 0.75 },
      { name: 'Extra Wings +2pc', price: 2.50 },
    ],
  },
  {
    id: 's1', category: 'sides', emoji: '🍟',
    name: 'Crinkle Cut Fries', price: 3.49,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500&q=80',
    description: 'Seasoned crinkle cut fries, sea salt',
    allergens: ['Gluten'],
    removables: [],
    add_ons: [{ name: 'Add Cheese Sauce', price: 0.75 }, { name: 'Add Bacon Bits', price: 1.00 }],
  },
  {
    id: 's2', category: 'sides', emoji: '🍟', badge: 'Popular',
    name: 'Loaded Fries', price: 5.49,
    image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&q=80',
    description: 'Fries topped with cheese sauce, bacon bits, spring onion',
    allergens: ['Gluten', 'Dairy', 'Eggs'],
    removables: ['No Bacon Bits', 'No Spring Onion', 'No Cheese Sauce'],
    add_ons: [{ name: 'Extra Cheese Sauce', price: 0.75 }],
  },
  {
    id: 's3', category: 'sides', emoji: '🥗',
    name: 'Creamy Coleslaw', price: 2.99,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
    description: 'House-made coleslaw with apple & caraway',
    allergens: ['Dairy', 'Eggs', 'Mustard', 'Celery'],
    removables: [],
    add_ons: [],
  },
  {
    id: 's4', category: 'sides', emoji: '🌽',
    name: 'Corn on the Cob', price: 3.99,
    image: 'https://images.unsplash.com/photo-1601593346740-925612772716?w=500&q=80',
    description: 'Grilled corn, herb butter, smoked paprika',
    allergens: ['Dairy'],
    removables: ['No Butter', 'No Paprika'],
    add_ons: [{ name: 'Extra Butter', price: 0.50 }],
  },
  {
    id: 'd1', category: 'drinks', emoji: '🥤',
    name: 'Coca-Cola', price: 2.49,
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80',
    description: 'Classic Coca-Cola, ice cold (500ml)',
    allergens: [],
    removables: ['No Ice'],
    add_ons: [],
  },
  {
    id: 'd2', category: 'drinks', emoji: '🍋', badge: 'New',
    name: 'Fresh Lemonade', price: 3.49,
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&q=80',
    description: 'House lemonade with fresh mint (400ml)',
    allergens: [],
    removables: ['No Mint'],
    add_ons: [],
  },
  {
    id: 'd3', category: 'drinks', emoji: '🥛',
    name: 'Thick Milkshake', price: 4.99,
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80',
    description: 'Vanilla, Chocolate or Strawberry (400ml)',
    allergens: ['Dairy', 'Eggs', 'Nuts'],
    removables: [],
    add_ons: [],
  },
  {
    id: 'd4', category: 'drinks', emoji: '💧',
    name: 'Still Water', price: 1.49,
    image: 'https://images.unsplash.com/photo-1559839914-17aae19cec71?w=500&q=80',
    description: 'Still mineral water (500ml)',
    allergens: [],
    removables: [],
    add_ons: [],
  },
]

const DELIVERY_FEE = 1.99

function getUniqueTags(items: MenuItem[]) {
  const flags = new Set<string>()
  const allergens = new Set<string>()
  for (const item of items) {
    for (const f of item.dietaryFlags ?? []) flags.add(f)
    for (const a of item.allergens ?? []) allergens.add(a)
  }
  return {
    dietaryFlags: [...flags].sort(),
    allergens: [...allergens].sort(),
  }
}

// ─── DB → ProductItem mapper ──────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cartTotal(cart: Cart, items: MenuItem[]) {
  return Object.entries(cart).reduce((sum, [key, entry]) => {
    const item = items.find((m) => m.id === itemIdOfKey(key))
    if (!item) return sum
    return sum + lineUnitPrice(item, entry) * entry.qty
  }, 0)
}

function cartCount(cart: Cart) {
  return Object.values(cart).reduce((s, entry) => s + entry.qty, 0)
}

// ─── Premium Menu Card ────────────────────────────────────────────────────────

function MenuCard({ item, qty, onOpenDrawer, onOpenDealPicker, onAdd, onRemove, mealFromPrice, hasDeal }: {
  item: MenuItem
  qty: number
  onOpenDrawer: () => void
  onOpenDealPicker: () => void
  onAdd: () => void
  onRemove: () => void
  mealFromPrice: string | null
  hasDeal: boolean
}) {
  const isOffer = item.compare_at_price != null && item.compare_at_price > item.price
  const isSoldOut = item.is_available === false
  const showMealRows = qty === 0 && !isSoldOut && mealFromPrice != null

  return (
    <div
      className={`group bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:shadow-[0_8px_40px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col ${isSoldOut ? 'opacity-50 grayscale pointer-events-none cursor-default' : 'cursor-pointer'}`}
      onClick={isSoldOut ? undefined : onOpenDrawer}
    >
      {/* Image — edge-to-edge with hover zoom */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 shrink-0">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* OFFER badge — vibrant, corner-pinned */}
        {isOffer && (
          <div className="absolute top-0 right-0 bg-brand-red text-white text-[11px] font-black px-3 py-2 rounded-bl-2xl flex items-center gap-1 shadow-lg z-10">
            🔥 OFFER
          </div>
        )}

        {/* Regular badge */}
        {item.badge && !isOffer && (
          <span className="absolute top-3 left-3 z-10 text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-900/80 text-white backdrop-blur-sm tracking-wide">
            {item.badge}
          </span>
        )}

        {/* DEAL badge — only when no other badge already occupies a corner */}
        {hasDeal && !isOffer && !item.badge && (
          <span className="absolute top-3 left-3 z-10 text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-red text-white backdrop-blur-sm tracking-wide">
            DEAL
          </span>
        )}

        {/* Allergen indicator */}
        {item.allergens && item.allergens.length > 0 && (
          <span className="absolute bottom-2 right-2 z-10 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-50/95 text-amber-700 border border-amber-200/80">
            ⚠ Allergens
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-heading font-bold text-[14px] text-zinc-900 leading-snug">
            {item.name}
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        </div>

        {/* Single / Meal Deal rows */}
        {showMealRows ? (
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onOpenDrawer}
              aria-label={`Add ${item.name} (single)`}
              className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2.5 hover:bg-zinc-100 transition-colors"
            >
              <span className="text-xs font-bold text-zinc-500 tracking-wide">SINGLE</span>
              <span className="flex items-center gap-2.5">
                <span className="font-heading font-black text-sm text-zinc-900">£{item.price.toFixed(2)}</span>
                <span className="w-7 h-7 rounded-full bg-brand-red text-white flex items-center justify-center shrink-0">
                  <Plus size={13} />
                </span>
              </span>
            </button>
            <button
              onClick={onOpenDealPicker}
              aria-label={`Add ${item.name} (meal deal)`}
              className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2.5 hover:bg-zinc-100 transition-colors"
            >
              <span className="text-xs font-bold text-zinc-500 tracking-wide">MEAL DEAL</span>
              <span className="flex items-center gap-2.5">
                <span className="font-heading font-black text-sm text-brand-red">{mealFromPrice}</span>
                <span className="w-7 h-7 rounded-full bg-brand-red text-white flex items-center justify-center shrink-0">
                  <Plus size={13} />
                </span>
              </span>
            </button>
          </div>
        ) : (
        /* Price + controls */
        <div className="flex items-center justify-between pt-0.5">
          {isSoldOut ? (
            <span className="font-heading font-black text-sm text-zinc-400">Sold Out</span>
          ) : isOffer ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-zinc-400 line-through leading-none">
                £{item.compare_at_price!.toFixed(2)}
              </span>
              <span className="font-heading font-black text-lg text-brand-red leading-none">
                £{item.price.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="font-heading font-black text-lg text-zinc-900">
              £{item.price.toFixed(2)}
            </span>
          )}

          {/* Qty controls — stop propagation so they don't open drawer */}
          {!isSoldOut && (
            <div onClick={e => e.stopPropagation()}>
              {qty > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onRemove}
                    className="w-7 h-7 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    aria-label="Remove one"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-zinc-900">{qty}</span>
                  <button
                    onClick={onAdd}
                    className="w-7 h-7 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
                    aria-label="Add one more"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenDrawer() }}
                  className="w-8 h-8 rounded-full bg-brand-red text-white hover:bg-red-700 flex items-center justify-center transition-all shadow-sm"
                  aria-label={`Add ${item.name}`}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

// ─── Filters Popover ─────────────────────────────────────────────────────────

function FiltersPopover({
  availableDietaryFlags, selectedFlags, onFlagsChange,
  availableAllergens, excludedAllergens, onExcludedAllergensChange,
  sortBy, onSortChange, showOffersOnly, onOffersChange, onClose,
}: {
  availableDietaryFlags: string[]
  selectedFlags: string[]
  onFlagsChange: (flags: string[]) => void
  availableAllergens: string[]
  excludedAllergens: string[]
  onExcludedAllergensChange: (allergens: string[]) => void
  sortBy: string
  onSortChange: (sort: string) => void
  showOffersOnly: boolean
  onOffersChange: (v: boolean) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const hasFilters = selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default' || showOffersOnly

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-zinc-100 p-5 space-y-5"
    >
      <div>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={showOffersOnly}
            onChange={() => onOffersChange(!showOffersOnly)}
            className="w-4 h-4 accent-red-600 rounded"
          />
          <span className="text-sm font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">🔥 Offers only</span>
        </label>
      </div>

      {availableDietaryFlags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-3">Dietary</p>
          <div className="space-y-2">
            {availableDietaryFlags.map((flag) => (
              <label key={flag} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFlags.includes(flag)}
                  onChange={() => onFlagsChange(
                    selectedFlags.includes(flag)
                      ? selectedFlags.filter((f) => f !== flag)
                      : [...selectedFlags, flag],
                  )}
                  className="w-4 h-4 accent-zinc-900 rounded"
                />
                <span className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors">{flag}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {availableAllergens.length > 0 && (
        <div className={availableDietaryFlags.length > 0 ? 'border-t border-zinc-100 pt-5' : ''}>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-3">Exclude Allergens</p>
          <div className="space-y-2">
            {availableAllergens.map((allergen) => (
              <label key={allergen} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={excludedAllergens.includes(allergen)}
                  onChange={() => onExcludedAllergensChange(
                    excludedAllergens.includes(allergen)
                      ? excludedAllergens.filter((a) => a !== allergen)
                      : [...excludedAllergens, allergen],
                  )}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <span className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors">{allergen}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-100 pt-5">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-3">Sort By</p>
        <div className="space-y-2">
          {([
            ['default', 'Default order'],
            ['price-asc', 'Price: Low to High'],
            ['price-desc', 'Price: High to Low'],
          ] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="sortBy"
                checked={sortBy === val}
                onChange={() => onSortChange(val)}
                className="w-4 h-4 accent-zinc-900"
              />
              <span className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={() => { onFlagsChange([]); onExcludedAllergensChange([]); onSortChange('default'); onOffersChange(false) }}
          className="w-full text-center text-xs text-zinc-400 hover:text-zinc-900 font-medium transition-colors underline underline-offset-2"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ cart, menuItems, storeOpen, onClose, onAdd, onRemove, fulfillmentMode }: {
  cart: Cart
  menuItems: MenuItem[]
  storeOpen: boolean
  onClose: () => void
  onAdd: (key: string) => void
  onRemove: (key: string) => void
  fulfillmentMode: 'delivery' | 'pickup'
}) {
  const lineItems = Object.entries(cart)
    .filter(([, entry]) => entry.qty > 0)
    .map(([key, entry]) => ({ key, item: menuItems.find((m) => m.id === itemIdOfKey(key))!, entry }))
    .filter(({ item }) => Boolean(item))

  const subtotal = cartTotal(cart, menuItems)

  function handleCheckout() {
    const cartPayload = lineItems.map(({ item, entry }) => {
      const unit = lineUnitPrice(item, entry)
      return {
        menu_item_id: item.id,
        name: item.name,
        price: unit,
        quantity: entry.qty,
        totalPrice: unit * entry.qty,
        spicy_level: entry.spicy_level,
        extras: entry.extras,
        removals: entry.removals,
        additions: entry.additions ?? [],
        notes: entry.notes?.trim() || undefined,
      }
    })
    sessionStorage.setItem('pendingCart', JSON.stringify(cartPayload))
    sessionStorage.setItem('fulfillment_mode', fulfillmentMode)
    window.location.href = '/checkout'
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 flex flex-col border-l border-zinc-100">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={17} className="text-zinc-700" />
            <h2 className="font-heading font-bold text-base text-zinc-900">Your Order</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors text-zinc-400 hover:text-zinc-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-300 p-8">
              <ShoppingCart size={40} strokeWidth={1} />
              <p className="text-sm font-medium text-zinc-400">Your cart is empty</p>
              <p className="text-xs text-zinc-300 text-center">Add items from the menu to get started</p>
            </div>
          ) : (
            lineItems.map(({ key, item, entry }) => (
              <div key={key} className="flex items-start gap-3 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    £{(lineUnitPrice(item, entry) * entry.qty).toFixed(2)}
                  </p>
                  {(entry.spicy_level || entry.removals.length > 0 || entry.additions.length > 0 || entry.extras.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entry.spicy_level && (
                        <span className="text-[10px] font-medium border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded">Spicy: {entry.spicy_level}</span>
                      )}
                      {entry.removals.map((r) => (
                        <span key={r} className="text-[10px] font-medium border border-red-200 text-red-600 px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                      {entry.additions.map((a) => (
                        <span key={a} className="text-[10px] font-medium border border-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">+ {a}</span>
                      ))}
                      {entry.extras.map((e) => (
                        <span key={`${e.category ?? ''}-${e.name}`} className="text-[10px] font-medium border border-green-200 text-green-700 px-1.5 py-0.5 rounded">+ {formatExtra(e)}</span>
                      ))}
                    </div>
                  )}
                  {entry.notes && (
                    <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 italic">
                      {entry.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => onRemove(key)}
                    className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-zinc-900">{entry.qty}</span>
                  <button
                    onClick={() => onAdd(key)}
                    className="w-6 h-6 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {lineItems.length > 0 && (
          <div className="border-t border-zinc-100 px-6 py-5 space-y-3 bg-zinc-50/50">
            {!storeOpen && (
              <div className="border border-red-200 rounded-xl px-3 py-2.5 text-center text-xs font-semibold text-red-600">
                Store is currently closed — orders disabled
              </div>
            )}
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span><span className="text-zinc-900 font-semibold">£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-400">
              <span>{fulfillmentMode === 'pickup' ? 'Collection' : 'Delivery'}</span>
              <span>{fulfillmentMode === 'pickup' ? 'Free' : 'calculated at checkout'}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={!storeOpen}
              className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <span>Checkout</span><ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderPage() {
  // Persisted to sessionStorage; also merges lines queued by /deals and /order/customize.
  const [cart, setCart] = useCart<CartEntry>()

  const router = useRouter()
  const [cartOpen, setCartOpen] = useState(false)
  const [categories, setCategories] = useState<DbCategory[]>([])
  const [activeCategory, setActive] = useState<string>('')
  const [dealPickerFor, setDealPickerFor] = useState<{ deal: BundleDeal; itemsById: Map<string, SlotItem> } | null>(null)
  const [activeDeals, setActiveDeals] = useState<ActiveDeal[]>([])
  const [activeBundles, setActiveBundles] = useState<BundleDeal[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS)
  const [storeOpen, setStoreOpen] = useState(true)
  const [closedReason, setClosedReason] = useState<string>('')
  const [closedUntil, setClosedUntil] = useState<string | null>(null)
  const [prepTime, setPrepTime] = useState(25)
  const [storeAddress, setStoreAddress] = useState('')
  const [fulfillmentMode, setFulfillmentMode] = useState<'delivery' | 'pickup'>('delivery')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFlags, setSelectedFlags] = useState<string[]>([])
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default')
  const [showOffersOnly, setShowOffersOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const navScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function checkNavScroll() {
    const el = navScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActive(categories[0].slug)
    // re-check arrow visibility whenever category list changes
    setTimeout(checkNavScroll, 50)
  }, [categories])

  useEffect(() => {
    fetch('/api/store-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setStoreOpen(data.isCurrentlyOpen ?? data.is_open ?? true)
          if (data.prep_time_minutes != null) setPrepTime(data.prep_time_minutes)
          if (data.store_address) setStoreAddress(data.store_address)
          if (!data.isCurrentlyOpen) {
            setClosedReason(data.closedReason || 'We are currently closed')
            setClosedUntil(data.closedUntil ?? null)
          }
        }
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    fetch('/api/menu-items')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<DbMenuItem[]>
      })
      .then((data) => {
        if (data.length > 0) setMenuItems(data.map(dbToMenuItem))
      })
      .catch((err) => { console.error('Failed to load menu items from database:', err) })
  }, [])

  useEffect(() => {
    fetch('/api/deals/active')
      .then((r) => r.json())
      .then((deals: ActiveDeal[]) => {
        setActiveDeals(deals)
        setActiveBundles(deals.filter((d) => d.type === 'bundle'))
      })
      .catch(() => {})
  }, [])

  const bundleFor = useMemo(() => {
    return (item: MenuItem): BundleDeal | undefined =>
      activeBundles.find((b) => b.config.groups.some((g) => inSlot({ item_ids: g.item_ids ?? [], category: g.category }, item)))
  }, [activeBundles])

  const mealFromPriceFor = useMemo(() => {
    return (item: MenuItem): string | null => {
      const cfg = bundleFor(item)?.config
      if (!cfg) return null
      return cfg.price_type === 'percent' ? `${cfg.discount_percent}% off` : `£${cfg.price.toFixed(2)}`
    }
  }, [bundleFor])

  const anyDealFor = useMemo(() => {
    return (item: MenuItem): boolean => {
      if (bundleFor(item)) return true
      return activeDeals.some((d) => {
        if (d.type === 'bogo') {
          const buyMatch = d.config.buy.item_ids?.includes(item.id) || d.config.buy.category === item.category
          const getMatch = d.config.get.item_ids?.includes(item.id) || d.config.get.category === item.category
          return Boolean(buyMatch || getMatch)
        }
        if (d.type === 'order_discount') {
          return d.config.scope === 'order' || d.config.category === item.category
        }
        return false
      })
    }
  }, [bundleFor, activeDeals])

  const { dietaryFlags: availableDietaryFlags, allergens: availableAllergens } = useMemo(
    () => getUniqueTags(menuItems),
    [menuItems],
  )

  const isFiltering = searchQuery.trim() !== '' || selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default' || showOffersOnly

  const displayedItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let result = menuItems.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.description ?? '').toLowerCase().includes(q)) return false
      if (selectedFlags.length > 0) {
        const flags = item.dietaryFlags ?? []
        if (!selectedFlags.every((f) => flags.includes(f))) return false
      }
      if (excludedAllergens.length > 0) {
        const itemAllergens = item.allergens ?? []
        if (excludedAllergens.some((a) => itemAllergens.includes(a))) return false
      }
      if (showOffersOnly && !(item.compare_at_price != null && item.compare_at_price > item.price)) return false
      return true
    })
    if (sortBy === 'price-asc') result = [...result].sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') result = [...result].sort((a, b) => b.price - a.price)
    return result
  }, [menuItems, searchQuery, selectedFlags, excludedAllergens, sortBy, showOffersOnly])

  const count = cartCount(cart)
  const total = cartTotal(cart, menuItems)

  function openDealPicker(item: MenuItem) {
    const bundle = bundleFor(item)
    if (!bundle) return
    const itemsById = new Map<string, SlotItem>(menuItems.filter((m) => m.is_available !== false).map((m) => [m.id, {
      id: m.id, name: m.name, price: m.price, image_url: m.image, category: m.category,
      extras: m.add_ons, removals: m.removables, additions: m.additions ?? null, modifiers: m.modifiers,
    }]))
    setDealPickerFor({ deal: bundle, itemsById })
  }

  // Card plus/minus act on the item's plain line; the drawer acts on a specific line key.
  function addToCart(id: string) {
    setCart((p) => addToLines(p, id, { removals: [], additions: [], extras: [] }, 1))
  }
  // Simple items (nothing to choose) go straight in at qty 1; anything else opens the customize page.
  function openItem(item: MenuItem) {
    if (hasNoCustomization(itemConfig(item))) addToCart(item.id)
    else router.push(`/order/customize/${item.id}`)
  }
  function removeFromCart(id: string) {
    setCart((p) => removeOneFromItem(p, id))
  }
  function addLine(key: string) {
    setCart((p) => changeLineQty(p, key, 1))
  }
  function removeLine(key: string) {
    setCart((p) => changeLineQty(p, key, -1))
  }
  // Still used by DealSlotPicker's onComplete to add picked/upgraded deal items to the cart.
  function handleAddToOrder(selection: OrderSelection) {
    setCart((p) => addToLines(p, selection.item.id, {
      spicy_level: selection.spicy_level,
      removals: selection.removals,
      additions: selection.additions ?? [],
      extras: selection.extras,
      notes: selection.notes || undefined,
    }, selection.quantity))
  }
  function scrollTo(id: string) {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    categories.forEach(({ slug: id }) => {
      const el = sectionRefs.current[id]
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id) },
        { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [categories])

  const activeFilterCount = selectedFlags.length + excludedAllergens.length + (sortBy !== 'default' ? 1 : 0) + (showOffersOnly ? 1 : 0)

  return (
    <div className="bg-white min-h-screen">

      {/* Closed banner */}
      {!storeOpen && (
        <div className="bg-zinc-900 text-white text-center py-3.5 text-xs font-medium tracking-wide space-y-0.5">
          <p>⚠️ {closedReason || 'We are currently not accepting orders.'}</p>
          {closedUntil && <p className="opacity-75">{closedUntil}</p>}
        </div>
      )}

      {/* Delivery banner */}
      {fulfillmentMode === 'delivery' && (
        <div className="bg-brand-red text-white text-center py-2.5 text-xs font-medium tracking-wide">
          Free delivery on orders over £20 &nbsp;·&nbsp; Est. {prepTime}–{prepTime + 10} min
        </div>
      )}

      {/* Fulfillment mode toggle */}
      <div className="flex justify-center py-3 px-4 bg-white border-b border-zinc-100">
        <div className="flex items-center bg-zinc-100 rounded-full p-1 gap-1">
          <button
            onClick={() => setFulfillmentMode('delivery')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${fulfillmentMode === 'delivery'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            🛵 Delivery
          </button>
          <button
            onClick={() => setFulfillmentMode('pickup')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${fulfillmentMode === 'pickup'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            🏃 Pickup
          </button>
        </div>
      </div>

      {/* Pickup info banner */}
      {fulfillmentMode === 'pickup' && (
        <div className="bg-amber-50 border-b border-amber-200 text-center py-2.5 px-4 text-xs font-medium text-amber-800">
          🛍️ Collect in store &nbsp;·&nbsp;
          {storeAddress ? <>{storeAddress} &nbsp;·&nbsp;</> : null}
          Ready in {prepTime}–{prepTime + 10} min · No delivery fee
        </div>
      )}

      {/* ── STICKY SCROLL-SPY CATEGORY NAV ── */}
      <nav className="sticky top-16 z-40 backdrop-blur-md bg-white/95 border-b border-zinc-100/80 shadow-sm">
        <div className="relative">
          {/* Left fade + arrow */}
          <div className={`absolute left-0 top-0 bottom-0 w-14 bg-gradient-to-r from-white/95 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
          {canScrollLeft && (
            <button
              onClick={() => { navScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' }) }}
              aria-label="Scroll categories left"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-white border border-zinc-200 rounded-full shadow-sm flex items-center justify-center hover:bg-zinc-50 transition-colors"
            >
              <ChevronLeft size={14} className="text-zinc-700" />
            </button>
          )}

          {/* Scrollable pills */}
          <div
            ref={navScrollRef}
            onScroll={checkNavScroll}
            className="flex flex-nowrap items-center gap-1 overflow-x-auto py-2.5 px-4 sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden scroll-smooth snap-x snap-mandatory"
          >
            {categories.map(({ slug, name, image_url }) => (
              <button
                key={slug}
                onClick={() => scrollTo(slug)}
                className={`flex-none shrink-0 snap-start flex items-center gap-2 px-4 py-2 text-[13px] font-semibold whitespace-nowrap rounded-full transition-all duration-200 ${activeCategory === slug
                  ? 'bg-brand-red text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                  }`}
              >
                {image_url && (
                  <Image
                    src={image_url}
                    alt={name}
                    width={20}
                    height={20}
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                )}
                {name}
              </button>
            ))}
          </div>

          {/* Right fade + arrow */}
          <div className={`absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-white/95 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />
          {canScrollRight && (
            <button
              onClick={() => { navScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' }) }}
              aria-label="Scroll categories right"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 bg-white border border-zinc-200 rounded-full shadow-sm flex items-center justify-center hover:bg-zinc-50 transition-colors"
            >
              <ChevronRight size={14} className="text-zinc-700" />
            </button>
          )}
        </div>
      </nav>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Search + filter bar */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search menu…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all duration-200 ${activeFilterCount > 0
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                }`}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white/20 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {filtersOpen && (
              <FiltersPopover
                availableDietaryFlags={availableDietaryFlags}
                selectedFlags={selectedFlags}
                onFlagsChange={setSelectedFlags}
                availableAllergens={availableAllergens}
                excludedAllergens={excludedAllergens}
                onExcludedAllergensChange={setExcludedAllergens}
                sortBy={sortBy}
                onSortChange={(v) => setSortBy(v as 'default' | 'price-asc' | 'price-desc')}
                showOffersOnly={showOffersOnly}
                onOffersChange={setShowOffersOnly}
                onClose={() => setFiltersOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 -mt-4">
            {showOffersOnly && (
              <span className="flex items-center gap-1.5 border border-red-200 text-red-700 bg-red-50 text-xs font-medium px-3 py-1 rounded-full">
                🔥 Offers only
                <button onClick={() => setShowOffersOnly(false)} className="text-red-400 hover:text-red-700 transition-colors">
                  <X size={11} />
                </button>
              </span>
            )}
            {selectedFlags.map((f) => (
              <span key={f} className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-xs font-medium px-3 py-1 rounded-full">
                {f}
                <button onClick={() => setSelectedFlags((prev) => prev.filter((x) => x !== f))} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
            {excludedAllergens.map((a) => (
              <span key={a} className="flex items-center gap-1.5 border border-amber-200 text-amber-700 bg-amber-50 text-xs font-medium px-3 py-1 rounded-full">
                No {a}
                <button onClick={() => setExcludedAllergens((prev) => prev.filter((x) => x !== a))} className="text-amber-400 hover:text-amber-700 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
            {sortBy !== 'default' && (
              <span className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-xs font-medium px-3 py-1 rounded-full">
                {sortBy === 'price-asc' ? 'Price: Low → High' : 'Price: High → Low'}
                <button onClick={() => setSortBy('default')} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* ── Content ── */}
        <main className="pb-28">
          {isFiltering ? (
            displayedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <Search size={32} strokeWidth={1} className="text-zinc-200 mb-4" />
                <p className="font-heading font-bold text-base text-zinc-400">No items found</p>
                <p className="text-sm text-zinc-300 mt-1">Try adjusting your search or filters.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedFlags([]); setExcludedAllergens([]); setSortBy('default'); setShowOffersOnly(false) }}
                  className="mt-5 text-sm text-zinc-500 font-medium underline underline-offset-2 hover:text-zinc-900 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {displayedItems.map((item) => (
                  <MenuCard
                    key={item.id} item={item} qty={itemQty(cart, item.id)}
                    onOpenDrawer={() => openItem(item)}
                    onOpenDealPicker={() => openDealPicker(item)}
                    mealFromPrice={mealFromPriceFor(item)}
                    hasDeal={anyDealFor(item)}
                    onAdd={() => addToCart(item.id)}
                    onRemove={() => removeFromCart(item.id)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-14">
              {categories.map(({ slug, name, image_url }) => {
                const items = menuItems.filter((m) => m.category.toLowerCase() === slug)
                return (
                  <section
                    key={slug}
                    id={slug}
                    ref={(el) => { sectionRefs.current[slug] = el }}
                    className="scroll-mt-20"
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-100">
                      <Image
                        src={image_url || FALLBACK_IMG}
                        alt={name}
                        width={36}
                        height={36}
                        className="w-9 h-9 rounded-xl object-cover shrink-0"
                      />
                      <div>
                        <h2 className="font-heading font-black text-xl text-zinc-900 leading-none">{name}</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">{items.length} items</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {items.map((item) => (
                        <MenuCard
                          key={item.id} item={item} qty={itemQty(cart, item.id)}
                          onOpenDrawer={() => openItem(item)}
                          onOpenDealPicker={() => openDealPicker(item)}
                          mealFromPrice={mealFromPriceFor(item)}
                          hasDeal={anyDealFor(item)}
                          onAdd={() => addToCart(item.id)}
                          onRemove={() => removeFromCart(item.id)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Floating cart pill */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setCartOpen(true)}
          className="cart-pill-animate flex items-center gap-3 bg-brand-red text-white font-semibold px-6 py-3.5 rounded-full shadow-xl hover:bg-red-700 transition-colors text-sm border-[3px] border-black"
        >
          <div className="relative">
            <ShoppingCart size={19} />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </div>
          {count === 0
            ? 'Cart'
            : <><span>{count} item{count > 1 ? 's' : ''}</span><span className="bg-white/15 px-2 py-0.5 rounded-full text-xs">£{total.toFixed(2)}</span></>
          }
        </button>
      </div>

      {/* Overlays */}
      {cartOpen && (
        <CartDrawer
          cart={cart} menuItems={menuItems} storeOpen={storeOpen}
          onClose={() => setCartOpen(false)}
          onAdd={addLine} onRemove={removeLine}
          fulfillmentMode={fulfillmentMode}
        />
      )}

      {dealPickerFor && (
        <DealSlotPicker
          deal={dealPickerFor.deal}
          itemsById={dealPickerFor.itemsById}
          onClose={() => setDealPickerFor(null)}
          onComplete={(picks, upgrades) => {
            for (const pick of picks) {
              const item = menuItems.find((m) => m.id === pick.item_id)
              if (!item) continue
              handleAddToOrder({
                item,
                quantity: pick.qty,
                spicy_level: pick.spicy_level,
                removals: pick.removals,
                additions: pick.additions,
                extras: pick.extras,
                notes: (pick.notes ?? '').trim(),
                totalPrice: lineUnitPrice(item, pick) * pick.qty,
              })
            }
            // Upgrades are ordinary menu items at their normal price.
            for (const up of upgrades) {
              const item = menuItems.find((m) => m.id === up.item_id)
              if (!item) continue
              handleAddToOrder({
                item,
                quantity: up.qty,
                removals: [],
                additions: [],
                extras: [],
                notes: '',
                totalPrice: item.price * up.qty,
              })
            }
            setDealPickerFor(null)
          }}
        />
      )}

      <ScrollToTop />
    </div>
  )
}
