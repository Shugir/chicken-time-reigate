'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/components/admin/permissions-provider'
import { createClient } from '@supabase/supabase-js'
import {
  ChefHat, CheckCircle, Clock, RefreshCw, Bell, BellOff, Printer,
  ArrowLeft, LogOut, Truck, AlertCircle, AlertTriangle, PackageCheck, MapPin, Phone, MessageSquare, User, Search,
} from 'lucide-react'

import {
  formatTime, formatTimeFull, formatDateMedium, formatDateClockLabel,
} from '@/lib/utils/format-date'

const ALERT_URL = '/KitchenAlert.mp3'
const MAX_DISPATCHED = 8

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Extra { name: string; price: number }

interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras:   Extra[]
  removals: string[]
  notes: string | null
}

interface Order {
  id: string
  status: 'preparing' | 'ready' | 'dispatched'
  total_amount: number
  created_at: string
  customer_name:      string | null
  customer_phone:     string | null
  delivery_address:   string | null
  delivery_postcode:  string | null
  customer_notes:     string | null
  order_items: OrderItem[]
}

interface Driver {
  id: string
  name: string
  phone: string | null
  status: string
  active_orders: number
}

interface DispatchOrder {
  id: string
  status: string
  delivery_status: string
  failure_reason: string | null
  total_amount: number
  created_at: string
  customer_name:      string | null
  customer_phone:     string | null
  delivery_address:   string | null
  delivery_postcode:  string | null
  customer_notes:     string | null
  driver_id: string | null
  drivers: Driver | null
  order_items: OrderItem[]
}

function elapsed(created_at: string) {
  const secs = Math.floor((Date.now() - new Date(created_at).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function OrderCard({
  order,
  onAction,
  actionLabel,
  actionStyle,
  updating,
  onReprintKitchen,
  onReprintCustomer,
  onSendBackToPrep,
}: {
  order: Order
  onAction?: () => void
  actionLabel?: string
  actionStyle?: string
  updating: boolean
  onReprintKitchen: () => void
  onReprintCustomer: () => void
  onSendBackToPrep?: () => void
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Order</p>
          <p className="font-mono font-bold text-white text-lg tracking-wider">
            #{order.id.slice(-6).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-white/50">
          <Clock size={12} />
          <span className="font-mono tabular-nums">{elapsed(order.created_at)}</span>
        </div>
      </div>

      {/* Customer info */}
      {(order.customer_name || order.customer_phone || order.delivery_address) && (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          {order.customer_name && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <User size={11} className="text-white/30 shrink-0" />
              <span className="font-semibold text-white/80">{order.customer_name}</span>
            </div>
          )}
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Phone size={11} className="text-white/30 shrink-0" />
              <span>{order.customer_phone}</span>
            </div>
          )}
          {order.delivery_address && (
            <div className="flex items-start gap-2 text-xs text-white/60">
              <MapPin size={11} className="text-white/30 shrink-0 mt-0.5" />
              <span>{order.delivery_address}</span>
            </div>
          )}
          {order.customer_notes && (
            <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-400/5 rounded-lg px-2 py-1.5">
              <MessageSquare size={11} className="shrink-0 mt-0.5" />
              <span>{order.customer_notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <ul className="space-y-3 border-t border-white/10 pt-4">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white leading-snug">
                <span className="text-brand-red font-black mr-2">{item.quantity}×</span>
                {item.item_name ?? 'Item'}
              </span>
              <span className="text-xs text-white/40 tabular-nums shrink-0">
                £{(item.unit_price * item.quantity).toFixed(2)}
              </span>
            </div>
            {(item.removals ?? []).length > 0 && (
              <ul className="pl-4 space-y-0.5">
                {(item.removals ?? []).map((r) => (
                  <li key={r} className="text-xs font-black text-red-400 uppercase tracking-wide">
                    NO {r}
                  </li>
                ))}
              </ul>
            )}
            {(item.extras ?? []).length > 0 && (
              <ul className="pl-4 space-y-0.5">
                {(item.extras ?? []).map((e) => (
                  <li key={e.name} className="text-xs font-semibold text-emerald-400">
                    + {e.name}
                  </li>
                ))}
              </ul>
            )}
            {item.notes && (
              <p className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded leading-snug">
                {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs text-white/40">Total</span>
        <span className="font-black text-white text-base">£{order.total_amount.toFixed(2)}</span>
      </div>

      {/* Primary action */}
      {onAction && actionLabel && actionStyle && (
        <button
          onClick={onAction}
          disabled={updating}
          className={`w-full py-4 rounded-xl font-black text-base tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${actionStyle}`}
        >
          {updating ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : actionLabel.startsWith('Dispatch') ? (
            <><Printer size={18} />{actionLabel}</>
          ) : (
            <><CheckCircle size={18} />{actionLabel}</>
          )}
        </button>
      )}

      {/* Send Back to Prep */}
      {onSendBackToPrep && (
        <button
          onClick={onSendBackToPrep}
          disabled={updating}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm font-black border border-amber-500/20 transition-colors disabled:opacity-50"
        >
          <AlertTriangle size={14} />
          ⚠️ Send Back to Prep
        </button>
      )}

      {/* Reprint row */}
      <div className="flex gap-2 border-t border-white/10 pt-3">
        {order.status === 'preparing' && (
          <button
            onClick={onReprintKitchen}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-lg py-1.5 text-xs font-semibold transition-colors"
          >
            <Printer size={11} />
            Reprint Kitchen
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={onReprintCustomer}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-lg py-1.5 text-xs font-semibold transition-colors"
          >
            <Printer size={11} />
            Reprint Receipt
          </button>
        )}
        {order.status === 'dispatched' && (
          <>
            <button
              onClick={onReprintKitchen}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            >
              <Printer size={11} />
              Kitchen
            </button>
            <button
              onClick={onReprintCustomer}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            >
              <Printer size={11} />
              Receipt
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Receipt components ────────────────────────────────────────────────────────

function KitchenTicket({ order }: { order: Order }) {
  return (
    <div className="hidden print:block w-[80mm] text-black bg-white font-mono text-sm p-2">
      <div className="text-center font-black text-base tracking-widest uppercase border-b border-black pb-2 mb-2">
        Chicken Time Reigate
      </div>
      <div className="text-center text-xs tracking-widest uppercase mb-3">
        *** Kitchen Ticket ***
      </div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold">Order</span>
        <span className="font-black">#{order.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-bold">Time</span>
        <span>{formatTime(order.created_at)}</span>
      </div>
      {order.customer_name && (
        <div className="flex justify-between text-xs mb-1">
          <span className="font-bold">Customer</span>
          <span>{order.customer_name}</span>
        </div>
      )}
      {order.delivery_address && (
        <div className="text-xs mb-1">
          <span className="font-bold">Address: </span>
          <span>{order.delivery_address}</span>
        </div>
      )}
      {order.customer_phone && (
        <div className="flex justify-between text-xs mb-3">
          <span className="font-bold">Phone</span>
          <span>{order.customer_phone}</span>
        </div>
      )}
      {!order.customer_phone && <div className="mb-3" />}
      <div className="border-t border-dashed border-black pt-2 mb-2">
        {order.order_items.map((item) => (
          <div key={item.id} className="mb-3">
            <div className="flex justify-between font-bold text-sm">
              <span>{item.quantity}x {item.item_name ?? 'Item'}</span>
              <span>£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
            {(item.removals ?? []).map((r) => (
              <div key={r} className="text-xs font-black uppercase tracking-wide">
                *** NO {r}
              </div>
            ))}
            {(item.extras ?? []).map((e) => (
              <div key={e.name} className="text-xs font-semibold">
                + {e.name} (£{e.price.toFixed(2)})
              </div>
            ))}
            {item.notes && (
              <div className="text-xs font-black uppercase tracking-wide border border-black px-1 mt-0.5">
                !! {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black pt-2 flex justify-between font-black text-sm mb-3">
        <span>TOTAL</span>
        <span>£{order.total_amount.toFixed(2)}</span>
      </div>
      <div className="border-t border-black pt-2 text-center text-xs text-gray-500">
        Printed {formatTimeFull(new Date())}
      </div>
    </div>
  )
}

function CustomerReceipt({ order }: { order: Order }) {
  const date = new Date(order.created_at)
  const subtotal = order.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  return (
    <div className="hidden print:block w-[80mm] text-black bg-white font-mono text-xs p-3">
      <div className="text-center mb-3">
        <p className="font-black text-sm tracking-widest uppercase">Chicken Time</p>
        <p className="font-black text-sm tracking-widest uppercase">Reigate</p>
        <p className="text-xs mt-1">01737 000 000</p>
        <p className="text-xs">chickentimesurrey.co.uk</p>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between mb-0.5">
        <span>Order</span>
        <span className="font-black">#{order.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="flex justify-between mb-0.5">
        <span>Date</span>
        <span>{formatDateMedium(date)}</span>
      </div>
      <div className="flex justify-between mb-0.5">
        <span>Time</span>
        <span>{formatTime(date)}</span>
      </div>
      {order.customer_name && (
        <div className="flex justify-between mb-0.5">
          <span>Customer</span>
          <span className="font-bold">{order.customer_name}</span>
        </div>
      )}
      {order.customer_phone && (
        <div className="flex justify-between mb-0.5">
          <span>Phone</span>
          <span>{order.customer_phone}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black my-2" />
      <div className="mb-2">
        {order.order_items.map((item) => (
          <div key={item.id} className="mb-2">
            <div className="flex justify-between">
              <span className="font-bold">{item.quantity}x {item.item_name ?? 'Item'}</span>
              <span className="font-bold">£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 pl-2">
              <span>@ £{item.unit_price.toFixed(2)} each</span>
            </div>
            {(item.extras ?? []).length > 0 && (item.extras ?? []).map((e) => (
              <div key={e.name} className="flex justify-between pl-2 text-gray-600" style={{ fontSize: '10px' }}>
                <span>+ {e.name}</span>
                <span>£{e.price.toFixed(2)}</span>
              </div>
            ))}
            {(item.removals ?? []).length > 0 && (item.removals ?? []).map((r) => (
              <div key={r} className="pl-2 text-gray-500" style={{ fontSize: '10px' }}>
                - No {r}
              </div>
            ))}
            {item.notes && (
              <div className="pl-2 text-gray-600 italic" style={{ fontSize: '10px' }}>{item.notes}</div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between mb-0.5">
        <span>Subtotal</span>
        <span>£{subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Delivery</span>
        <span>£{(order.total_amount - subtotal).toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-black text-sm border-t border-black pt-1 mt-1">
        <span>TOTAL</span>
        <span>£{order.total_amount.toFixed(2)}</span>
      </div>

      {order.delivery_address && (
        <>
          <div className="border-t border-black mt-3 pt-2">
            <p className="text-center font-black text-xs tracking-widest uppercase mb-2">
              --- DELIVERY DETAILS ---
            </p>
            {order.customer_name && (
              <p className="font-black text-sm leading-snug">{order.customer_name}</p>
            )}
            {order.customer_phone && (
              <p className="font-black text-sm leading-snug">{order.customer_phone}</p>
            )}
            <p className="font-black text-sm leading-snug mt-1">{order.delivery_address}</p>
            {order.delivery_postcode && (
              <p className="font-black text-base tracking-widest uppercase mt-1">
                {order.delivery_postcode}
              </p>
            )}
            {order.customer_notes && (
              <p className="font-bold text-xs mt-1 border border-black px-1 py-0.5 uppercase tracking-wide">
                NOTE: {order.customer_notes}
              </p>
            )}
          </div>
          <div className="border-t border-dashed border-black mt-3 mb-2" />
        </>
      )}

      {!order.delivery_address && <div className="border-t border-dashed border-black my-3" />}
      <div className="text-center">
        <p className="font-bold">Thank you for your order!</p>
        <p className="mt-1 text-gray-500">We hope to see you again soon.</p>
        <p className="mt-2 text-gray-400">VAT Reg: GB 000 0000 00</p>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function KitchenDashboard() {
  const router = useRouter()
  const { can, email } = usePermissions()
  const [activeTab, setActiveTab] = useState<'kitchen' | 'dispatch'>('kitchen')

  // Kitchen state
  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [updating, setUpdating]       = useState<string | null>(null)

  // Dispatch state
  const [dispatchOrders, setDispatchOrders]     = useState<DispatchOrder[]>([])
  const [dispatchLoading, setDispatchLoading]   = useState(false)
  const [dispatchUpdating, setDispatchUpdating] = useState<string | null>(null)
  const [failModalOrder, setFailModalOrder]     = useState<DispatchOrder | null>(null)
  const [failReason, setFailReason]             = useState('')

  // Driver select modal
  const [driverModalOrder, setDriverModalOrder]         = useState<Order | null>(null)
  const [reassignDispatchOrder, setReassignDispatchOrder] = useState<DispatchOrder | null>(null)
  const [availableDrivers, setAvailableDrivers]         = useState<Driver[]>([])
  const [driversLoading, setDriversLoading]             = useState(false)

  // Search / filter
  const [searchQuery, setSearchQuery]   = useState('')
  const [driverFilter, setDriverFilter] = useState('')

  // Print
  const [now, setNow]                 = useState(new Date())
  const [mounted, setMounted]         = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [printOrder, setPrintOrder]   = useState<Order | null>(null)
  const [printMode, setPrintMode]     = useState<'kitchen' | 'customer' | null>(null)
  const audioUnlockedRef              = useRef(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function toggleAudio() {
    const next = !audioUnlockedRef.current
    audioUnlockedRef.current = next
    setAudioUnlocked(next)
  }

  function playAlert() {
    if (!audioUnlockedRef.current) return
    try { new Audio(ALERT_URL).play() } catch { /* ignore */ }
  }

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!printMode || !printOrder) return
    const timer = setTimeout(() => {
      window.print()
      const reset = () => {
        setPrintMode(null)
        setPrintOrder(null)
        window.removeEventListener('afterprint', reset)
      }
      window.addEventListener('afterprint', reset)
    }, 50)
    return () => clearTimeout(timer)
  }, [printMode, printOrder])

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/kitchen/orders')
    const data = await res.json()
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  const fetchDispatchOrders = useCallback(async () => {
    setDispatchLoading(true)
    const res = await fetch('/api/kitchen/delivery')
    if (res.ok) setDispatchOrders(await res.json())
    setDispatchLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as { id: string; status: string; delivery_status?: string }
          if (updated.status === 'preparing') {
            playAlert()
            fetchOrders()
          } else if (updated.status === 'ready') {
            setOrders((prev) =>
              prev.map((o) => o.id === updated.id ? { ...o, status: 'ready' as const } : o),
            )
          } else if (updated.status === 'dispatched') {
            setOrders((prev) =>
              prev.map((o) => o.id === updated.id ? { ...o, status: 'dispatched' as const } : o),
            )
            // Refresh dispatch tab if it shows this order
            if (updated.delivery_status === 'out_for_delivery') fetchDispatchOrders()
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, fetchDispatchOrders])

  useEffect(() => {
    if (activeTab === 'dispatch') fetchDispatchOrders()
  }, [activeTab, fetchDispatchOrders])

  async function updateStatus(id: string, status: 'ready' | 'dispatched') {
    setUpdating(id)
    await fetch(`/api/kitchen/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(null)
  }

  async function openDriverModal(order: Order) {
    setDriverModalOrder(order)
    setDriversLoading(true)
    const res = await fetch('/api/drivers')
    if (res.ok) setAvailableDrivers(await res.json())
    setDriversLoading(false)
  }

  async function openReassignModal(order: DispatchOrder) {
    setReassignDispatchOrder(order)
    setDriversLoading(true)
    const res = await fetch('/api/drivers')
    if (res.ok) setAvailableDrivers(await res.json())
    setDriversLoading(false)
  }

  async function handleReassign(driver: Driver) {
    if (!reassignDispatchOrder) return
    const order = reassignDispatchOrder
    setReassignDispatchOrder(null)
    setDispatchUpdating(order.id)
    await fetch(`/api/kitchen/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driver.id }),
    })
    setDispatchUpdating(null)
    fetchDispatchOrders()
  }

  async function sendBackToPrep(id: string) {
    setUpdating(id)
    await fetch(`/api/kitchen/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing', driver_id: null, delivery_status: null }),
    })
    setUpdating(null)
    fetchOrders()
  }

  async function sendBackToPrepFromDispatch(order: DispatchOrder) {
    setDispatchUpdating(order.id)
    await fetch(`/api/kitchen/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing', driver_id: null, delivery_status: null }),
    })
    setDispatchUpdating(null)
    await Promise.all([fetchOrders(), fetchDispatchOrders()])
  }

  async function handleDispatch(driver: Driver) {
    if (!driverModalOrder) return
    const order = driverModalOrder
    setDriverModalOrder(null)
    setUpdating(order.id)
    await fetch(`/api/kitchen/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:          'dispatched',
        driver_id:       driver.id,
        delivery_status: 'out_for_delivery',
      }),
    })
    setUpdating(null)
    setPrintOrder(order)
    setPrintMode('customer')
  }

  function triggerReprint(order: Order, mode: 'kitchen' | 'customer') {
    setPrintOrder(order)
    setPrintMode(mode)
  }

  async function handleDelivered(order: DispatchOrder) {
    setDispatchUpdating(order.id)
    await fetch(`/api/kitchen/delivery/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_status: 'delivered' }),
    })
    setDispatchUpdating(null)
    fetchDispatchOrders()
  }

  async function handleFailed(order: DispatchOrder, reason: string) {
    setDispatchUpdating(order.id)
    await fetch(`/api/kitchen/delivery/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_status: 'failed', failure_reason: reason }),
    })
    setDispatchUpdating(null)
    setFailModalOrder(null)
    setFailReason('')
    fetchDispatchOrders()
  }

  const sq = searchQuery.trim().toLowerCase()
  const preparing  = orders.filter((o) => o.status === 'preparing' && (!sq || o.id.toLowerCase().includes(sq)))
  const ready      = orders.filter((o) => o.status === 'ready'     && (!sq || o.id.toLowerCase().includes(sq)))
  const dispatched = orders
    .filter((o) => o.status === 'dispatched' && (!sq || o.id.toLowerCase().includes(sq)))
    .slice(-MAX_DISPATCHED)
    .reverse()
  const filteredDispatchOrders = driverFilter
    ? dispatchOrders.filter((o) => o.drivers?.name?.toLowerCase().includes(driverFilter.toLowerCase()))
    : dispatchOrders

  return (
    <div className="fixed inset-0 z-[200] bg-[#0d0d0d] overflow-hidden flex flex-col">

      <div className="contents print:hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-red rounded-xl flex items-center justify-center">
              <ChefHat size={20} className="text-white" />
            </div>
            <div>
              <p className="font-black text-white text-base leading-none">Kitchen Dashboard</p>
              <p className="text-xs text-white/40 mt-0.5">Chicken Time Reigate</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'kitchen'
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <ChefHat size={14} />
              Kitchen
            </button>
            {mounted && can('DispatchController') && (
              <button
                onClick={() => setActiveTab('dispatch')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'dispatch'
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Truck size={14} />
                Dispatch
                {dispatchOrders.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center">
                    {dispatchOrders.length}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {email && (
              <div className="text-right hidden lg:block">
                <p className="text-[10px] text-white/30 leading-none">Signed in</p>
                <p className="text-xs text-white/60 font-medium leading-tight mt-0.5 max-w-[140px] truncate">{email}</p>
              </div>
            )}
            <button
              onClick={toggleAudio}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                audioUnlocked
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70'
              }`}
              title={audioUnlocked ? 'Mute alerts' : 'Unmute alerts'}
            >
              {audioUnlocked ? <Bell size={14} /> : <BellOff size={14} />}
              {audioUnlocked ? 'Alerts On' : 'Unmute Alerts'}
            </button>

            <Link
              href="/admin/redirect"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} />
              Admin
            </Link>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-brand-red/20 text-red-400 hover:bg-brand-red hover:text-white transition-colors"
            >
              <LogOut size={13} />
              Sign Out
            </button>

            <div className="text-right">
              <p className="font-mono font-bold text-white text-xl tabular-nums">
                {mounted ? formatTimeFull(now) : ''}
              </p>
              <p className="text-xs text-white/40 font-mono">
                {mounted ? formatDateClockLabel(now) : ''}
              </p>
            </div>
          </div>
        </header>

        {/* ── Kitchen Tab ── */}
        {activeTab === 'kitchen' && (
          <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2.5 border-b border-white/10 bg-[#111] shrink-0 flex items-center gap-3">
            <Search size={14} className="text-white/30 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order ID…"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none font-mono"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white/60 text-xs font-bold transition-colors">
                ✕
              </button>
            )}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">

            {/* Preparing */}
            <div className="flex flex-col border-r border-white/10 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-red/30 bg-brand-red/5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-brand-red animate-pulse" />
                <h2 className="font-black text-white text-sm uppercase tracking-widest">Preparing</h2>
                <span className="ml-auto bg-brand-red text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                  {preparing.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <p className="text-white/30 text-sm text-center pt-12">Loading…</p>
                ) : preparing.length === 0 ? (
                  <p className="text-white/20 text-sm text-center pt-12">No orders preparing</p>
                ) : (
                  preparing.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAction={() => updateStatus(order.id, 'ready')}
                      actionLabel="Mark Ready"
                      actionStyle="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/40"
                      updating={updating === order.id}
                      onReprintKitchen={() => triggerReprint(order, 'kitchen')}
                      onReprintCustomer={() => triggerReprint(order, 'customer')}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Ready */}
            <div className="flex flex-col border-r border-white/10 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-emerald-500/30 bg-emerald-500/5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <h2 className="font-black text-white text-sm uppercase tracking-widest">Ready</h2>
                <span className="ml-auto bg-emerald-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                  {ready.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <p className="text-white/30 text-sm text-center pt-12">Loading…</p>
                ) : ready.length === 0 ? (
                  <p className="text-white/20 text-sm text-center pt-12">No orders ready</p>
                ) : (
                  ready.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAction={() => openDriverModal(order)}
                      actionLabel="Dispatch & Print"
                      actionStyle="bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-900/40"
                      updating={updating === order.id}
                      onReprintKitchen={() => triggerReprint(order, 'kitchen')}
                      onReprintCustomer={() => triggerReprint(order, 'customer')}
                      onSendBackToPrep={() => sendBackToPrep(order.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Recently Dispatched */}
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <span className="w-3 h-3 rounded-full bg-white/20" />
                <h2 className="font-black text-white/50 text-sm uppercase tracking-widest">Dispatched</h2>
                <span className="ml-auto bg-white/10 text-white/40 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                  {dispatched.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <p className="text-white/30 text-sm text-center pt-12">Loading…</p>
                ) : dispatched.length === 0 ? (
                  <p className="text-white/20 text-sm text-center pt-12">No recent dispatches</p>
                ) : (
                  dispatched.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      updating={false}
                      onReprintKitchen={() => triggerReprint(order, 'kitchen')}
                      onReprintCustomer={() => triggerReprint(order, 'customer')}
                    />
                  ))
                )}
              </div>
            </div>

          </div>
          </div>
        )}

        {/* ── Dispatch Tab ── */}
        {activeTab === 'dispatch' && mounted && can('DispatchController') && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white">Dispatch Controller</h2>
                <p className="text-xs text-white/40 mt-0.5">Orders currently out for delivery</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type="text"
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    placeholder="Filter by driver…"
                    className="bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 w-40"
                  />
                </div>
                <button
                  onClick={fetchDispatchOrders}
                  disabled={dispatchLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-xs font-bold transition-colors"
                >
                  <RefreshCw size={13} className={dispatchLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {dispatchLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw size={28} className="text-white/20 animate-spin" />
              </div>
            ) : filteredDispatchOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Truck size={40} className="text-white/10 mb-3" />
                <p className="text-white/30 text-sm font-bold">No orders out for delivery</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
                {filteredDispatchOrders.map((order) => (
                  <div key={order.id} className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Order</p>
                        <p className="font-mono font-bold text-white text-lg tracking-wider">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-sky-500/10 rounded-lg px-3 py-1.5 text-xs text-sky-400">
                        <Truck size={11} />
                        <span className="font-mono tabular-nums">{elapsed(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Customer address */}
                    {order.delivery_address && (
                      <div className="flex items-start gap-2 bg-sky-500/10 rounded-xl px-3 py-2 border border-sky-500/20">
                        <MapPin size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          {order.customer_name && (
                            <p className="text-xs font-bold text-white leading-none mb-0.5">{order.customer_name}</p>
                          )}
                          <p className="text-xs text-sky-300">{order.delivery_address}</p>
                          {order.delivery_postcode && (
                            <p className="text-sm font-black text-sky-200 tracking-widest uppercase mt-0.5">{order.delivery_postcode}</p>
                          )}
                          {order.customer_phone && (
                            <p className="text-xs text-white/40 mt-0.5">{order.customer_phone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {order.customer_notes && (
                      <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-400/5 rounded-lg px-2 py-1.5">
                        <MessageSquare size={11} className="shrink-0 mt-0.5" />
                        <span>{order.customer_notes}</span>
                      </div>
                    )}

                    {/* Driver — with reassign */}
                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                      <Truck size={14} className="text-sky-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {order.drivers ? (
                          <>
                            <p className="text-sm font-bold text-white leading-none">{order.drivers.name}</p>
                            {order.drivers.phone && (
                              <p className="text-xs text-white/40 mt-0.5">{order.drivers.phone}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-white/40 italic">No driver assigned</p>
                        )}
                      </div>
                      <button
                        onClick={() => openReassignModal(order)}
                        disabled={dispatchUpdating === order.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw size={11} />
                        Reassign
                      </button>
                    </div>

                    {/* Items summary */}
                    <div className="border-t border-white/10 pt-3 space-y-1">
                      {order.order_items.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-white/70">
                            <span className="text-brand-red font-black">{item.quantity}×</span> {item.item_name ?? 'Item'}
                          </span>
                          <span className="text-white/40">£{(item.unit_price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-xs text-white/30">+{order.order_items.length - 3} more items</p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-xs text-white/40">Total</span>
                      <span className="font-black text-white text-base">£{Number(order.total_amount).toFixed(2)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelivered(order)}
                          disabled={dispatchUpdating === order.id}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black transition-colors disabled:opacity-50"
                        >
                          {dispatchUpdating === order.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <PackageCheck size={14} />
                          )}
                          Delivered
                        </button>
                        <button
                          onClick={() => { setFailModalOrder(order); setFailReason('') }}
                          disabled={dispatchUpdating === order.id}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-black transition-colors disabled:opacity-50"
                        >
                          <AlertCircle size={14} />
                          Failed
                        </button>
                      </div>
                      <button
                        onClick={() => sendBackToPrepFromDispatch(order)}
                        disabled={dispatchUpdating === order.id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-sm font-black border border-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        <AlertTriangle size={14} />
                        ⚠️ Send Back to Prep
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Receipts — only visible during print */}
      {printOrder && printMode === 'kitchen'  && <KitchenTicket order={printOrder} />}
      {printOrder && printMode === 'customer' && <CustomerReceipt order={printOrder} />}

      {/* ── Driver Select / Reassign Modal ── */}
      {(driverModalOrder || reassignDispatchOrder) && (() => {
        const isReassign = reassignDispatchOrder !== null
        const activeOrderId = driverModalOrder?.id ?? reassignDispatchOrder!.id
        const closeModal = () => { setDriverModalOrder(null); setReassignDispatchOrder(null) }
        const selectDriver = (driver: Driver) => isReassign ? handleReassign(driver) : handleDispatch(driver)
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/15 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-black text-white text-base">{isReassign ? 'Reassign Driver' : 'Select Driver'}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Order #{activeOrderId.slice(-6).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>

              {driversLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={20} className="text-white/30 animate-spin" />
                </div>
              ) : availableDrivers.length === 0 ? (
                <div className="text-center py-8">
                  <Truck size={32} className="text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">No active drivers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDrivers.map((driver) => {
                    const load = driver.active_orders ?? 0
                    const loadColor = load === 0 ? 'bg-emerald-500' : load === 1 ? 'bg-amber-500' : 'bg-red-500'
                    const loadLabel = load === 0 ? 'Available' : `${load} active`
                    return (
                      <button
                        key={driver.id}
                        onClick={() => selectDriver(driver)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-sky-500/30 transition-all text-left group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0 group-hover:bg-sky-500/30 transition-colors">
                          <Truck size={16} className="text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm">{driver.name}</p>
                          {driver.phone && (
                            <p className="text-xs text-white/40">{driver.phone}</p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white ${loadColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                          {loadLabel}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                onClick={closeModal}
                className="w-full mt-4 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Fail Reason Modal ── */}
      {failModalOrder && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-black text-white text-base">Mark as Failed</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Order #{failModalOrder.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setFailModalOrder(null)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-white/60 mb-3">Reason for failure:</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {['No Answer', 'Wrong Address', 'Damaged', 'Refused Delivery'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setFailReason(reason)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                    failReason === reason
                      ? 'bg-red-500/30 border-red-500/50 text-red-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Or type a custom reason…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setFailModalOrder(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 hover:text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => failReason.trim() && handleFailed(failModalOrder, failReason.trim())}
                disabled={!failReason.trim() || dispatchUpdating === failModalOrder.id}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-black transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {dispatchUpdating === failModalOrder.id ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <AlertCircle size={14} />
                )}
                Confirm Failed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
