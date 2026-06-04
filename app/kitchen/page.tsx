'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ChefHat, CheckCircle, Clock, RefreshCw, Bell, BellOff, Printer } from 'lucide-react'

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
}: {
  order: Order
  onAction?: () => void
  actionLabel?: string
  actionStyle?: string
  updating: boolean
  onReprintKitchen: () => void
  onReprintCustomer: () => void
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

      {/* Reprint row — conditional by status */}
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
      <div className="flex justify-between text-xs mb-3">
        <span className="font-bold">Time</span>
        <span>{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
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
        Printed {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
        <span>{date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="flex justify-between mb-2">
        <span>Time</span>
        <span>{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="mb-2">
        {order.order_items.map((item) => (
          <div key={item.id} className="mb-1.5">
            <div className="flex justify-between">
              <span className="font-bold">{item.quantity}x {item.item_name ?? 'Item'}</span>
              <span className="font-bold">£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 pl-2">
              <span>@ £{item.unit_price.toFixed(2)} each</span>
            </div>
            {item.notes && (
              <div className="pl-2 text-gray-600 italic">{item.notes}</div>
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
      <div className="border-t border-dashed border-black my-3" />
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
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [printOrder, setPrintOrder] = useState<Order | null>(null)
  const [printMode, setPrintMode] = useState<'kitchen' | 'customer' | null>(null)
  const audioUnlockedRef = useRef(false)

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

  async function updateStatus(id: string, status: 'ready' | 'dispatched') {
    setUpdating(id)
    await fetch(`/api/kitchen/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdating(null)
  }

  async function dispatchAndPrint(order: Order) {
    updateStatus(order.id, 'dispatched')
    setPrintOrder(order)
    setPrintMode('customer')
  }

  function triggerReprint(order: Order, mode: 'kitchen' | 'customer') {
    setPrintOrder(order)
    setPrintMode(mode)
  }

  const preparing  = orders.filter((o) => o.status === 'preparing')
  const ready      = orders.filter((o) => o.status === 'ready')
  const dispatched = orders
    .filter((o) => o.status === 'dispatched')
    .slice(-MAX_DISPATCHED)
    .reverse()

  return (
    <div className="fixed inset-0 z-[200] bg-[#0d0d0d] overflow-hidden flex flex-col">

      {/* Kanban — hidden during print */}
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
          <div className="flex items-center gap-4">
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
            <div className="text-right">
              <p className="font-mono font-bold text-white text-xl tabular-nums">
                {mounted ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
              </p>
              <p className="text-xs text-white/40 font-mono">
                {mounted ? now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
              </p>
            </div>
          </div>
        </header>

        {/* 3-column Kanban */}
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
                    onAction={() => dispatchAndPrint(order)}
                    actionLabel="Dispatch & Print"
                    actionStyle="bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-900/40"
                    updating={updating === order.id}
                    onReprintKitchen={() => triggerReprint(order, 'kitchen')}
                    onReprintCustomer={() => triggerReprint(order, 'customer')}
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
      {printOrder && printMode === 'kitchen'  && <KitchenTicket order={printOrder} />}
      {printOrder && printMode === 'customer' && <CustomerReceipt order={printOrder} />}

    </div>
  )
}
