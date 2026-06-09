'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/components/admin/permissions-provider'
import { createClient } from '@supabase/supabase-js'
import {
  ChefHat, CheckCircle, Clock, RefreshCw, Bell, BellOff, Printer,
  ArrowLeft, LogOut, Truck, AlertTriangle, MapPin, Phone, MessageSquare, User, Search,
} from 'lucide-react'

import {
  formatTime, formatTimeFull, formatDateClockLabel,
} from '@/lib/utils/format-date'
import { CustomerReceipt } from '@/components/CustomerReceipt'

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
  extras: Extra[]
  removals: string[]
  notes: string | null
}

interface Order {
  id: string
  status: 'preparing' | 'ready' | 'dispatched'
  total_amount: number
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  customer_notes: string | null
  order_type?: 'delivery' | 'pickup'
  order_items: OrderItem[]
}

interface Driver {
  id: string
  name: string
  phone: string | null
  status: string
  active_orders: number
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
          {order.order_type === 'pickup' ? (
            <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">🛍️ Collection</span>
          ) : (
            <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wide">🚗 Delivery</span>
          )}
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
    <div className="receipt-print hidden print:block w-[80mm] text-black bg-white font-mono text-sm p-2">
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function KitchenDashboard() {
  const router = useRouter()
  const { can, email } = usePermissions()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Driver dispatch modal
  const [driverModalOrder, setDriverModalOrder] = useState<Order | null>(null)
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])
  const [driversLoading, setDriversLoading] = useState(false)

  // Print
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [printMode, setPrintMode] = useState<'kitchen' | 'customer' | null>(null)
  const audioUnlockedRef = useRef(false)

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

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
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
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  async function updateStatus(id: string, status: 'ready' | 'dispatched' | 'delivered') {
    setUpdating(id)
    await fetch(`/api/kitchen/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(null)
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

  async function openDriverModal(order: Order) {
    setDriverModalOrder(order)
    setDriversLoading(true)
    const res = await fetch('/api/drivers')
    if (res.ok) setAvailableDrivers(await res.json())
    setDriversLoading(false)
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
        status: 'dispatched',
        driver_id: driver.id,
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

  const sq = searchQuery.trim().toLowerCase()
  const preparing = orders.filter((o) => o.status === 'preparing' && (!sq || o.id.toLowerCase().includes(sq)))
  const ready = orders.filter((o) => o.status === 'ready' && (!sq || o.id.toLowerCase().includes(sq)))
  const dispatched = orders
    .filter((o) => o.status === 'dispatched' && (!sq || o.id.toLowerCase().includes(sq)))
    .slice(-MAX_DISPATCHED)
    .reverse()

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
              <p className="font-black text-white text-base leading-none">Kitchen Display</p>
              <p className="text-xs text-white/40 mt-0.5">Chicken Time Reigate</p>
            </div>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${audioUnlocked
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70'
                }`}
              title={audioUnlocked ? 'Mute alerts' : 'Unmute alerts'}
            >
              {audioUnlocked ? <Bell size={14} /> : <BellOff size={14} />}
              {audioUnlocked ? 'Alerts On' : 'Unmute Alerts'}
            </button>

            {mounted && can('DispatchController') && (
              <Link
                href="/admin/dispatch"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors"
              >
                <Truck size={13} />
                Dispatch Board
              </Link>
            )}

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

        {/* Search bar */}
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

        {/* Three-column KDS */}
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
                    onAction={order.order_type === 'pickup'
                      ? () => updateStatus(order.id, 'delivered')
                      : () => openDriverModal(order)
                    }
                    actionLabel={order.order_type === 'pickup' ? '✓ Mark Collected' : 'Dispatch & Print'}
                    actionStyle={order.order_type === 'pickup'
                      ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-900/40'
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-900/40'
                    }
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

      {/* Receipts — only visible during print */}
      {printOrder && printMode === 'kitchen' && <KitchenTicket order={printOrder} />}
      {printOrder && printMode === 'customer' && <CustomerReceipt order={printOrder} />}

      {/* Driver Select Modal */}
      {driverModalOrder && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-black text-white text-base">Select Driver</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Order #{driverModalOrder.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setDriverModalOrder(null)}
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
                      onClick={() => handleDispatch(driver)}
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
              onClick={() => setDriverModalOrder(null)}
              className="w-full mt-4 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white text-sm font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
