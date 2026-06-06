'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect, useMemo } from 'react'
import Image from 'next/image'
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  ChevronRight,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from 'lucide-react'
import { ProductItem, ProductModal, OrderSelection, AddOn } from '../../components/ProductModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type MenuItem = ProductItem & { dietaryFlags?: string[] }
interface CartEntry { qty: number; removals: string[]; extras: AddOn[]; notes?: string }
type Cart = Record<string, CartEntry>

interface DbCategory {
  id: string; name: string; slug: string; sort_order: number
  image_url: string | null; description: string | null
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80'

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
      { name: 'Add Buffalo Dip',     price: 0.75 },
      { name: 'Add Blue Cheese Dip', price: 0.75 },
      { name: 'Extra Wings +2pc',    price: 2.50 },
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
  const flags     = new Set<string>()
  const allergens = new Set<string>()
  for (const item of items) {
    for (const f of item.dietaryFlags ?? []) flags.add(f)
    for (const a of item.allergens    ?? []) allergens.add(a)
  }
  return {
    dietaryFlags: [...flags].sort(),
    allergens:    [...allergens].sort(),
  }
}

// ─── DB → ProductItem mapper ──────────────────────────────────────────────────

interface DbMenuItem {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string
  is_available: boolean
  extras:        Array<{ name: string; price: number }> | null
  removals:      string[] | null
  dietary_flags: string[] | null
  allergens: string[] | null
  custom_options: {
    emoji?: string
    badge?: string
    allergens?: string[]
    removables?: string[]
    add_ons?: Array<{ name: string; price: number }>
  } | null
}

function dbToMenuItem(item: DbMenuItem): MenuItem {
  const opts = item.custom_options ?? {}
  return {
    id:           item.id,
    name:         item.name,
    description:  item.description ?? '',
    price:        Number(item.price),
    category:     item.category.toLowerCase(),
    badge:        opts.badge,
    emoji:        opts.emoji ?? '🍽️',
    image:        item.image_url || FALLBACK_IMG,
    allergens:    item.allergens?.length ? item.allergens : (opts.allergens ?? []),
    removables:   item.removals?.length ? item.removals  : (opts.removables ?? []),
    add_ons:      item.extras?.length   ? item.extras    : (opts.add_ons    ?? []),
    dietaryFlags: item.dietary_flags ?? [],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cartTotal(cart: Cart, items: MenuItem[]) {
  return Object.entries(cart).reduce((sum, [id, entry]) => {
    const item = items.find((m) => m.id === id)
    if (!item) return sum
    const extrasPrice = entry.extras.reduce((s, e) => s + e.price, 0)
    return sum + (item.price + extrasPrice) * entry.qty
  }, 0)
}

function cartCount(cart: Cart) {
  return Object.values(cart).reduce((s, entry) => s + entry.qty, 0)
}

// ─── Menu Card ────────────────────────────────────────────────────────────────

function MenuCard({ item, qty, onOpenModal, onAdd, onRemove }: {
  item: MenuItem
  qty: number
  onOpenModal: () => void
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <div className="group bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col">

      {/* Image */}
      <button
        onClick={onOpenModal}
        className="relative aspect-video w-full overflow-hidden bg-zinc-100 shrink-0"
        aria-label={`View ${item.name} details`}
      >
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {item.badge && (
          <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/95 text-zinc-800 tracking-wide border border-zinc-200/80">
            {item.badge}
          </span>
        )}
        {item.allergens && item.allergens.length > 0 && (
          <span className="absolute bottom-2 right-2 z-10 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-50/95 text-amber-700 border border-amber-200/80">
            ⚠ Allergens
          </span>
        )}
      </button>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div className="flex-1">
          <h3
            className="font-heading font-bold text-[15px] text-zinc-900 leading-snug cursor-pointer hover:text-brand-red transition-colors duration-200"
            onClick={onOpenModal}
          >
            {item.name}
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        </div>

        {/* Price + controls */}
        <div className="flex items-center justify-between pt-1">
          <span className="font-heading font-bold text-lg text-zinc-900">
            £{item.price.toFixed(2)}
          </span>

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
              onClick={onOpenModal}
              className="w-8 h-8 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 flex items-center justify-center transition-all duration-200"
              aria-label={`Add ${item.name}`}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Filters Popover ─────────────────────────────────────────────────────────

function FiltersPopover({
  availableDietaryFlags, selectedFlags, onFlagsChange,
  availableAllergens, excludedAllergens, onExcludedAllergensChange,
  sortBy, onSortChange, onClose,
}: {
  availableDietaryFlags: string[]
  selectedFlags: string[]
  onFlagsChange: (flags: string[]) => void
  availableAllergens: string[]
  excludedAllergens: string[]
  onExcludedAllergensChange: (allergens: string[]) => void
  sortBy: string
  onSortChange: (sort: string) => void
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

  const hasFilters = selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default'

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-zinc-100 p-5 space-y-5"
    >
      {availableDietaryFlags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.12em] mb-3">Dietary</p>
          <p className="text-[10px] text-zinc-400 mb-2.5 -mt-1">Show items that match all selected</p>
          <div className="space-y-2">
            {availableDietaryFlags.map((flag) => (
              <label key={flag} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedFlags.includes(flag)}
                  onChange={() => onFlagsChange(
                    selectedFlags.includes(flag)
                      ? selectedFlags.filter((f) => f !== flag)
                      : [...selectedFlags, flag]
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
          <p className="text-[10px] text-zinc-400 mb-2.5 -mt-1">Hide items that contain these</p>
          <div className="space-y-2">
            {availableAllergens.map((allergen) => (
              <label key={allergen} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={excludedAllergens.includes(allergen)}
                  onChange={() => onExcludedAllergensChange(
                    excludedAllergens.includes(allergen)
                      ? excludedAllergens.filter((a) => a !== allergen)
                      : [...excludedAllergens, allergen]
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
          onClick={() => { onFlagsChange([]); onExcludedAllergensChange([]); onSortChange('default') }}
          className="w-full text-center text-xs text-zinc-400 hover:text-zinc-900 font-medium transition-colors underline underline-offset-2"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

// ─── Compact List Item ────────────────────────────────────────────────────────

function CompactListItem({ item, qty, onOpenModal, onAdd, onRemove }: {
  item: MenuItem
  qty: number
  onOpenModal: () => void
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all duration-200 flex items-center gap-4 p-3">
      <button
        onClick={onOpenModal}
        className="shrink-0 relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100"
        aria-label={`View ${item.name} details`}
      >
        <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className="font-heading font-semibold text-sm text-zinc-900 truncate cursor-pointer hover:text-brand-red transition-colors"
            onClick={onOpenModal}
          >
            {item.name}
          </h3>
          {item.badge && (
            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-zinc-200 text-zinc-500">
              {item.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 truncate mt-0.5">{item.description}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.dietaryFlags?.slice(0, 3).map((f) => (
            <span key={f} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-zinc-200 text-zinc-500">{f}</span>
          ))}
          {item.allergens && item.allergens.length > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-200 text-amber-600 bg-amber-50">⚠ Allergens</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <span className="font-heading font-bold text-sm text-zinc-900">£{item.price.toFixed(2)}</span>
        {qty > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRemove}
              className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <Minus size={10} />
            </button>
            <span className="w-4 text-center text-xs font-bold text-zinc-900">{qty}</span>
            <button
              onClick={onAdd}
              className="w-6 h-6 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenModal}
            className="w-7 h-7 rounded-full border border-zinc-200 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 flex items-center justify-center transition-all duration-200"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ cart, menuItems, storeOpen, onClose, onAdd, onRemove }: {
  cart: Cart
  menuItems: MenuItem[]
  storeOpen: boolean
  onClose: () => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const lineItems = Object.entries(cart)
    .filter(([, entry]) => entry.qty > 0)
    .map(([id, entry]) => ({ item: menuItems.find((m) => m.id === id)!, entry }))
    .filter(({ item }) => Boolean(item))

  const subtotal = cartTotal(cart, menuItems)

  function handleCheckout() {
    const cartPayload = lineItems.map(({ item, entry }) => {
      const unitPrice = item.price + entry.extras.reduce((s, e) => s + e.price, 0)
      return {
        name:       item.name,
        price:      unitPrice,
        quantity:   entry.qty,
        totalPrice: unitPrice * entry.qty,
        extras:     entry.extras,
        removals:   entry.removals,
        notes:      entry.notes?.trim() || undefined,
      }
    })
    sessionStorage.setItem('pendingCart', JSON.stringify(cartPayload))
    window.location.href = '/checkout'
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 flex flex-col border-l border-zinc-100">

        {/* Header */}
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

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-300 p-8">
              <ShoppingCart size={40} strokeWidth={1} />
              <p className="text-sm font-medium text-zinc-400">Your cart is empty</p>
              <p className="text-xs text-zinc-300 text-center">Add items from the menu to get started</p>
            </div>
          ) : (
            lineItems.map(({ item, entry }) => (
              <div key={item.id} className="flex items-start gap-3 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    £{((item.price + entry.extras.reduce((s, e) => s + e.price, 0)) * entry.qty).toFixed(2)}
                  </p>
                  {(entry.removals.length > 0 || entry.extras.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entry.removals.map((r) => (
                        <span key={r} className="text-[10px] font-medium border border-red-200 text-red-600 px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                      {entry.extras.map((e) => (
                        <span key={e.name} className="text-[10px] font-medium border border-green-200 text-green-700 px-1.5 py-0.5 rounded">+ {e.name}</span>
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
                    onClick={() => onRemove(item.id)}
                    className="w-6 h-6 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-zinc-900">{entry.qty}</span>
                  <button
                    onClick={() => onAdd(item.id)}
                    className="w-6 h-6 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 flex items-center justify-center transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
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
              <span>Delivery</span><span>calculated at checkout</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={!storeOpen}
              className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
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
  const [cart, setCart]                   = useState<Cart>({})
  const [cartOpen, setCartOpen]           = useState(false)
  const [categories, setCategories]       = useState<DbCategory[]>([])
  const [activeCategory, setActive]       = useState<string>('')
  const [selectedItem, setSelectedItem]   = useState<MenuItem | null>(null)
  const [menuItems, setMenuItems]         = useState<MenuItem[]>(MENU_ITEMS)
  const [storeOpen, setStoreOpen]         = useState(true)
  const [prepTime, setPrepTime]           = useState(25)
  const [searchQuery, setSearchQuery]         = useState('')
  const [selectedFlags, setSelectedFlags]     = useState<string[]>([])
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([])
  const [sortBy, setSortBy]                   = useState<'default' | 'price-asc' | 'price-desc'>('default')
  const [viewMode, setViewMode]           = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen]     = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActive(categories[0].slug)
  }, [categories])

  useEffect(() => {
    fetch('/api/store-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) { setStoreOpen(data.is_open); setPrepTime(data.prep_time_minutes) }
      })
      .catch(() => {})
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

  const { dietaryFlags: availableDietaryFlags, allergens: availableAllergens } = useMemo(
    () => getUniqueTags(menuItems),
    [menuItems],
  )

  const isFiltering = searchQuery.trim() !== '' || selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default'

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
      return true
    })
    if (sortBy === 'price-asc')  result = [...result].sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') result = [...result].sort((a, b) => b.price - a.price)
    return result
  }, [menuItems, searchQuery, selectedFlags, excludedAllergens, sortBy])

  const count = cartCount(cart)
  const total = cartTotal(cart, menuItems)

  function addToCart(id: string) {
    setCart((p) => ({
      ...p,
      [id]: { qty: (p[id]?.qty ?? 0) + 1, removals: p[id]?.removals ?? [], extras: p[id]?.extras ?? [] },
    }))
  }
  function removeFromCart(id: string) {
    setCart((p) => {
      const qty = (p[id]?.qty ?? 0) - 1
      if (qty <= 0) { const n = { ...p }; delete n[id]; return n }
      return { ...p, [id]: { ...p[id], qty } }
    })
  }
  function handleAddToOrder(selection: OrderSelection) {
    setCart((p) => ({
      ...p,
      [selection.item.id]: {
        qty:      (p[selection.item.id]?.qty ?? 0) + selection.quantity,
        removals: selection.removals,
        extras:   selection.extras,
        notes:    selection.notes || undefined,
      },
    }))
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

  return (
    <div className="bg-white min-h-screen">

      {/* Closed banner */}
      {!storeOpen && (
        <div className="bg-zinc-900 text-white text-center py-3.5 text-xs font-medium tracking-wide">
          We are currently closed and not accepting orders.
        </div>
      )}

      {/* Delivery banner */}
      <div className="bg-brand-red text-white text-center py-2.5 text-xs font-medium tracking-wide">
        Free delivery on orders over £20 &nbsp;·&nbsp; Est. {prepTime}–{prepTime + 10} min
      </div>

      {/* Mobile category nav */}
      <nav className="lg:hidden sticky top-0 z-30 bg-white border-b border-zinc-100 overflow-x-auto">
        <div className="flex min-w-max gap-1 px-4 py-2.5">
          {categories.map(({ slug, name }) => (
            <button
              key={slug}
              onClick={() => scrollTo(slug)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold whitespace-nowrap rounded-full transition-all duration-200 ${
                activeCategory === slug
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </nav>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto flex gap-10 px-4 sm:px-6 lg:px-8 py-10">

        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-8">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.15em] px-3 mb-3">
              Menu
            </p>

            <nav className="space-y-0.5">
              {categories.map(({ slug, name, image_url }) => {
                const isActive = activeCategory === slug
                return (
                  <button
                    key={slug}
                    onClick={() => scrollTo(slug)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <Image
                      src={image_url || FALLBACK_IMG}
                      alt={name}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <span className="text-sm font-semibold truncate">{name}</span>
                  </button>
                )
              })}
            </nav>

            {/* Sidebar cart summary */}
            {count > 0 && (
              <div className="mt-6 border border-zinc-100 rounded-2xl p-4">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.15em] mb-3">
                  Your Order
                </p>
                <div className="flex justify-between text-sm font-semibold text-zinc-900 mb-3">
                  <span>{count} item{count > 1 ? 's' : ''}</span>
                  <span>£{total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setCartOpen(true)}
                  className="w-full bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={13} /> View Cart
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Menu content */}
        <main className="flex-1 min-w-0 pb-32">

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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all duration-200 ${
                  selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {(selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default') && (
                  <span className="bg-white/20 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {selectedFlags.length + excludedAllergens.length + (sortBy !== 'default' ? 1 : 0)}
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
                  onClose={() => setFiltersOpen(false)}
                />
              )}
            </div>

            <div className="flex items-center gap-0.5 border border-zinc-200 rounded-full p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {(selectedFlags.length > 0 || excludedAllergens.length > 0 || sortBy !== 'default') && (
            <div className="flex flex-wrap gap-2 mb-6 -mt-4">
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

          {/* Content */}
          {isFiltering ? (
            displayedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <Search size={32} strokeWidth={1} className="text-zinc-200 mb-4" />
                <p className="font-heading font-bold text-base text-zinc-400">No items found</p>
                <p className="text-sm text-zinc-300 mt-1">Try adjusting your search or filters.</p>
                <button
                  onClick={() => { setSearchQuery(''); setSelectedFlags([]); setExcludedAllergens([]); setSortBy('default') }}
                  className="mt-5 text-sm text-zinc-500 font-medium underline underline-offset-2 hover:text-zinc-900 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {displayedItems.map((item) => (
                  <CompactListItem
                    key={item.id} item={item} qty={cart[item.id]?.qty ?? 0}
                    onOpenModal={() => setSelectedItem(item)}
                    onAdd={() => addToCart(item.id)}
                    onRemove={() => removeFromCart(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayedItems.map((item) => (
                  <MenuCard
                    key={item.id} item={item} qty={cart[item.id]?.qty ?? 0}
                    onOpenModal={() => setSelectedItem(item)}
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
                    className="scroll-mt-6"
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

                    {viewMode === 'list' ? (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <CompactListItem
                            key={item.id} item={item} qty={cart[item.id]?.qty ?? 0}
                            onOpenModal={() => setSelectedItem(item)}
                            onAdd={() => addToCart(item.id)}
                            onRemove={() => removeFromCart(item.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {items.map((item) => (
                          <MenuCard
                            key={item.id} item={item} qty={cart[item.id]?.qty ?? 0}
                            onOpenModal={() => setSelectedItem(item)}
                            onAdd={() => addToCart(item.id)}
                            onRemove={() => removeFromCart(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Mobile floating cart */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setCartOpen(true)}
          className="flex items-center gap-3 bg-zinc-900 text-white font-semibold px-6 py-3.5 rounded-full shadow-lg hover:bg-zinc-700 transition-colors text-sm"
        >
          <div className="relative">
            <ShoppingCart size={17} />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand-red text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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
          onAdd={addToCart} onRemove={removeFromCart}
        />
      )}

      {selectedItem && (
        <ProductModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToOrder={handleAddToOrder}
        />
      )}
    </div>
  )
}
