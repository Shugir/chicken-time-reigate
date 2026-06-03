'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ChefHat, CheckCircle, Truck, Clock, RefreshCw, Bell, BellOff } from 'lucide-react'

const ALERT_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
}

interface Order {
  id: string
  status: 'preparing' | 'ready'
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
}: {
  order: Order
  onAction: () => void
  actionLabel: string
  actionStyle: string
  updating: boolean
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-5 flex flex-col gap-4">
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

      <ul className="space-y-2 border-t border-white/10 pt-4">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-white leading-snug">
              <span className="text-brand-red font-black mr-2">{item.quantity}×</span>
              {item.item_name ?? 'Item'}
            </span>
            <span className="text-xs text-white/40 tabular-nums shrink-0">
              £{(item.unit_price * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs text-white/40">Total</span>
        <span className="font-black text-white text-base">£{order.total_amount.toFixed(2)}</span>
      </div>

      <button
        onClick={onAction}
        disabled={updating}
        className={`w-full py-4 rounded-xl font-black text-base tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${actionStyle}`}
      >
        {updating ? (
          <RefreshCw size={18} className="animate-spin" />
        ) : actionLabel === 'Mark Ready' ? (
          <><CheckCircle size={18} />{actionLabel}</>
        ) : (
          <><Truck size={18} />{actionLabel}</>
        )}
      </button>
    </div>
  )
}

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [audioUnlocked, setAudioUnlocked] = useState(false)
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
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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
              prev.map((o) =>
                o.id === updated.id ? { ...o, status: 'ready' as const } : o,
              ),
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

  const preparing = orders.filter((o) => o.status === 'preparing')
  const ready = orders.filter((o) => o.status === 'ready')

  return (
    <div className="fixed inset-0 z-[200] bg-[#0d0d0d] overflow-hidden flex flex-col">

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
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-white/40 font-mono">
              {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </header>

      {/* Kanban columns */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">

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
                />
              ))
            )}
          </div>
        </div>

        {/* Ready */}
        <div className="flex flex-col overflow-hidden">
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
                  onAction={() => updateStatus(order.id, 'dispatched')}
                  actionLabel="Dispatch"
                  actionStyle="bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-900/40"
                  updating={updating === order.id}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
