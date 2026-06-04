'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  ChevronRight,
} from 'lucide-react'
import { ProductItem, ProductModal, OrderSelection } from '../../components/ProductModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'deals' | 'burgers' | 'chicken' | 'sides' | 'drinks'
type MenuItem = ProductItem
interface CartEntry { qty: number; removals: string[]; extras: string[] }
type Cart = Record<string, CartEntry>

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; image: string; description: string }[] = [
  { id: 'deals',   label: 'Deals',   image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80', description: 'Combo meals & special offers' },
  { id: 'burgers', label: 'Burgers', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=80', description: 'Crispy fillets & stacked classics' },
  { id: 'chicken', label: 'Chicken', image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=200&q=80', description: 'Wings, strips & whole pieces' },
  { id: 'sides',   label: 'Sides',   image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=200&q=80', description: 'The perfect companions' },
  { id: 'drinks',  label: 'Drinks',  image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=200&q=80', description: 'Cold drinks & shakes' },
]

const CARD_GRADIENT: Record<Category, string> = {
  deals:   'from-brand-red/10 via-red-50 to-orange-50',
  burgers: 'from-orange-100 via-amber-50 to-yellow-50',
  chicken: 'from-red-100 via-orange-50 to-amber-50',
  sides:   'from-yellow-100 via-lime-50 to-green-50',
  drinks:  'from-sky-100 via-blue-50 to-indigo-50',
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
      { name: 'Add Buffalo Dip',    price: 0.75 },
      { name: 'Add Blue Cheese Dip', price: 0.75 },
      { name: 'Extra Wings +2pc',   price: 2.50 },
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

const BADGE_STYLES: Record<string, string> = {
  Hot:     'bg-red-100 text-red-700',
  New:     'bg-emerald-100 text-emerald-700',
  Popular: 'bg-amber-100 text-amber-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cartTotal(cart: Cart) {
  return Object.entries(cart).reduce((sum, [id, entry]) => {
    const item = MENU_ITEMS.find((m) => m.id === id)
    return sum + (item ? item.price * entry.qty : 0)
  }, 0)
}

function cartCount(cart: Cart) {
  return Object.values(cart).reduce((s, entry) => s + entry.qty, 0)
}

// ─── Premium menu card ────────────────────────────────────────────────────────

function MenuCard({ item, qty, onOpenModal, onAdd, onRemove }: {
  item: MenuItem
  qty: number
  onOpenModal: () => void
  onAdd: () => void
  onRemove: () => void
}) {
  const gradient = CARD_GRADIENT[item.category]

  return (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col border border-gray-100/80">

      {/* Image area */}
      <button
        onClick={onOpenModal}
        className={`relative w-full h-44 bg-gradient-to-br ${gradient} overflow-hidden shrink-0`}
        aria-label={`View ${item.name} details`}
      >
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />
        {item.badge && (
          <span className={`absolute top-3 left-3 z-10 text-xs font-bold px-2.5 py-1 rounded-full ${BADGE_STYLES[item.badge] ?? 'bg-gray-100 text-gray-600'}`}>
            {item.badge}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </button>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3
            className="font-heading font-black text-base text-brand-dark leading-snug cursor-pointer hover:text-brand-red transition-colors"
            onClick={onOpenModal}
          >
            {item.name}
          </h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <span className="font-heading font-black text-xl text-brand-dark">
            £{item.price.toFixed(2)}
          </span>
          {qty > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={onRemove}
                className="w-7 h-7 rounded-full border-2 border-brand-red text-brand-red hover:bg-red-50 flex items-center justify-center transition-colors"
                aria-label="Remove one"
              >
                <Minus size={12} />
              </button>
              <span className="w-5 text-center text-sm font-black text-brand-dark">{qty}</span>
              <button
                onClick={onAdd}
                className="w-7 h-7 rounded-full bg-brand-red hover:bg-red-700 text-white flex items-center justify-center transition-colors"
                aria-label="Add one more"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={onOpenModal}
          className="w-full bg-brand-red hover:bg-red-700 active:bg-red-800 text-white text-sm font-black py-3 rounded-xl transition-colors shadow-md shadow-red-500/20 flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          Add to Order
        </button>
      </div>
    </div>
  )
}

// ─── Cart drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ cart, onClose, onAdd, onRemove }: {
  cart: Cart
  onClose: () => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const lineItems = Object.entries(cart)
    .filter(([, entry]) => entry.qty > 0)
    .map(([id, entry]) => ({ item: MENU_ITEMS.find((m) => m.id === id)!, entry }))
    .filter(({ item }) => Boolean(item))

  const subtotal = cartTotal(cart)
  const total    = subtotal + DELIVERY_FEE

  async function handleCheckout() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lineItems.map(({ item, entry }) => ({
            name: item.name,
            price: item.price,
            quantity: entry.qty,
            totalPrice: item.price * entry.qty,
            notes: [...entry.removals, ...entry.extras.map((e) => `+ ${e}`)].join(', ') || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Checkout API error:', data.error)
        alert(`Checkout failed: ${data.error ?? 'Unknown error'}`)
        setCheckoutLoading(false)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout fetch error:', err)
      alert('Something went wrong. Please try again.')
      setCheckoutLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-dark text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} />
            <h2 className="font-heading font-bold text-base">Your Order</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-8">
              <ShoppingCart size={44} className="opacity-20" />
              <p className="text-sm font-medium">Your cart is empty</p>
              <p className="text-xs text-center">Add items from the menu to get started</p>
            </div>
          ) : (
            lineItems.map(({ item, entry }) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="text-2xl w-9 text-center select-none mt-0.5">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">£{(item.price * entry.qty).toFixed(2)}</p>
                  {(entry.removals.length > 0 || entry.extras.length > 0) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.removals.map((r) => (
                        <span key={r} className="text-xs font-semibold bg-red-50 text-brand-red px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                      {entry.extras.map((e) => (
                        <span key={e} className="text-xs font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">+ {e}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-6 h-6 rounded-full border border-brand-red text-brand-red hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-4 text-center text-sm font-bold text-gray-900">{entry.qty}</span>
                  <button
                    onClick={() => onAdd(item.id)}
                    className="w-6 h-6 rounded-full bg-brand-red hover:bg-red-700 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {lineItems.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-5 space-y-3 bg-gray-50">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery</span><span>£{DELIVERY_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
              <span>Total</span><span>£{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full bg-brand-red hover:bg-red-700 active:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {checkoutLoading ? 'Processing…' : <><span>Checkout</span><ChevronRight size={16} /></>}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderPage() {
  const [cart, setCart]                 = useState<Cart>({})
  const [cartOpen, setCartOpen]         = useState(false)
  const [activeCategory, setActive]     = useState<Category>('deals')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const sectionRefs = useRef<Record<Category, HTMLElement | null>>({
    deals: null, burgers: null, chicken: null, sides: null, drinks: null,
  })

  const count = cartCount(cart)
  const total = cartTotal(cart)

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
        qty: (p[selection.item.id]?.qty ?? 0) + selection.quantity,
        removals: selection.removals,
        extras: selection.extras.map((e) => e.name),
      },
    }))
  }
  function scrollTo(id: Category) {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    CATEGORIES.forEach(({ id }) => {
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
  }, [])

  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Delivery banner */}
      <div className="bg-brand-red text-white text-center py-2.5 text-xs font-semibold tracking-wide">
        🚚 Free delivery on orders over £20 · Est. 25–35 min
      </div>

      {/* Mobile category nav */}
      <nav className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm overflow-x-auto">
        <div className="flex min-w-max">
          {CATEGORIES.map(({ id, label, image }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeCategory === id
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Image src={image} alt={label} width={20} height={20} className="w-5 h-5 rounded-full object-cover shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto flex gap-8 px-4 sm:px-6 lg:px-8 py-8">

        {/* Sticky sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-6 space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-4 mb-4">
              Menu
            </p>

            {CATEGORIES.map(({ id, label, image, description }) => {
              const isActive = activeCategory === id
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`relative w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-white shadow-md shadow-gray-200/80'
                      : 'hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-brand-red transition-all duration-200 ${
                      isActive ? 'h-9 opacity-100' : 'h-0 opacity-0'
                    }`}
                  />
                  <span className={`shrink-0 ${isActive ? 'ring-2 ring-brand-red ring-offset-2' : ''} rounded-full transition-all duration-200`}>
                    <Image src={image} alt={label} width={48} height={48} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                  </span>
                  <div>
                    <p className={`text-sm font-bold leading-tight transition-colors ${
                      isActive ? 'text-brand-dark' : 'text-gray-600 group-hover:text-brand-dark'
                    }`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{description}</p>
                  </div>
                </button>
              )
            })}

            {/* Sidebar cart summary */}
            {count > 0 && (
              <div className="mt-6 bg-brand-dark rounded-2xl p-4 text-white">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Your Order</p>
                <div className="flex justify-between text-sm font-semibold mb-4">
                  <span>{count} item{count > 1 ? 's' : ''}</span>
                  <span>£{total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setCartOpen(true)}
                  className="w-full bg-brand-red hover:bg-red-700 transition-colors text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={14} /> View Cart
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Menu sections */}
        <main className="flex-1 min-w-0 space-y-12 pb-32">
          {CATEGORIES.map(({ id, label, image }) => {
            const items = MENU_ITEMS.filter((m) => m.category === id)
            return (
              <section
                key={id}
                id={id}
                ref={(el) => { sectionRefs.current[id] = el }}
                className="scroll-mt-4"
              >
                {/* Section header */}
                <div className="flex items-center gap-3 mb-6">
                  <Image src={image} alt={label} width={40} height={40} className="w-10 h-10 rounded-xl object-cover shadow-sm shrink-0" />
                  <div>
                    <h2 className="font-heading font-black text-2xl text-brand-dark leading-none">{label}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{items.length} items</p>
                  </div>
                </div>

                {/* Premium card grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      qty={cart[item.id]?.qty ?? 0}
                      onOpenModal={() => setSelectedItem(item)}
                      onAdd={() => addToCart(item.id)}
                      onRemove={() => removeFromCart(item.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </main>
      </div>

      {/* Mobile floating cart */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setCartOpen(true)}
          className="flex items-center gap-3 bg-brand-dark text-white font-bold px-7 py-3.5 rounded-full shadow-2xl hover:bg-black transition-colors"
        >
          <div className="relative">
            <ShoppingCart size={19} />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-brand-red text-white text-xs font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {count}
              </span>
            )}
          </div>
          {count === 0
            ? 'Cart'
            : <><span>{count} item{count > 1 ? 's' : ''}</span><span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">£{total.toFixed(2)}</span></>
          }
        </button>
      </div>

      {/* Overlays */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onAdd={addToCart}
          onRemove={removeFromCart}
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
