'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { usePermissions } from '@/components/admin/permissions-provider'
import toast from 'react-hot-toast'
import {
  Radio, RefreshCw, Loader2, Truck, MapPin, User, Clock,
  AlertCircle, Flag, PackageCheck, AlertTriangle, Phone,
  MessageSquare, StickyNote, Bell, BellOff,
} from 'lucide-react'
import {
  formatTime, formatTimeFull, formatDateMedium, formatDateClockLabel,
} from '@/lib/utils/format-date'

const ALERT_URL = '/KitchenAlert.mp3'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
}

interface DispatchOrder {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_notes: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  total_amount: number
  created_at: string
  status: string
  driver_id?: string | null
  stop_sequence?: number
  delivery_status?: string | null
  driver_notes?: string | null
  order_items?: OrderItem[]
}

interface DispatchDriver {
  id: string
  name: string
  status: string
  phone: string | null
  orders: DispatchOrder[]
}

interface BoardData {
  unassigned: DispatchOrder[]
  drivers: DispatchDriver[]
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

// ── Customer receipt (printed on driver assign) ───────────────────────────────

function CustomerReceipt({ order }: { order: DispatchOrder }) {
  const date = new Date(order.created_at)
  const items = order.order_items ?? []
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

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
        {items.map((item) => (
          <div key={item.id} className="mb-2">
            <div className="flex justify-between">
              <span className="font-bold">{item.quantity}x {item.item_name ?? 'Item'}</span>
              <span className="font-bold">£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 pl-2">
              <span>@ £{item.unit_price.toFixed(2)} each</span>
            </div>
            {(item.extras ?? []).map((e) => (
              <div key={e.name} className="flex justify-between pl-2 text-gray-600" style={{ fontSize: '10px' }}>
                <span>+ {e.name}</span>
                <span>£{e.price.toFixed(2)}</span>
              </div>
            ))}
            {(item.removals ?? []).map((r) => (
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
      <div className="border-t border-black mt-3 pt-2 text-center text-gray-500">
        Printed {formatTimeFull(new Date())}
      </div>
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  drivers,
  onAssign,
  onSequence,
  onDelivered,
  onFailed,
  onSendBack,
  onNoteBlur,
  updating,
}: {
  order: DispatchOrder
  drivers: DispatchDriver[]
  onAssign: (orderId: string, driverId: string | null) => void
  onSequence: (orderId: string, seq: number) => Promise<void>
  onDelivered: (orderId: string) => void
  onFailed: (order: DispatchOrder) => void
  onSendBack: (orderId: string) => void
  onNoteBlur: (orderId: string, note: string) => void
  updating: boolean
}) {
  const assigned = !!order.driver_id
  const currentSeq = order.stop_sequence ?? 1

  async function handlePriorityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const seq = Number(e.target.value)
    await onSequence(order.id, seq)
    toast.success(`Priority updated to Drop #${seq}`, { duration: 2000 })
  }

  return (
    <div className={`rounded-2xl border bg-zinc-900 overflow-hidden shadow-md transition-all ${
      updating ? 'opacity-60 pointer-events-none' : ''
    } ${assigned ? 'border-zinc-700' : 'border-amber-500/40'}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
        <div className="flex items-center gap-2">
          {assigned && (
            <span className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-[11px]">
              {currentSeq}
            </span>
          )}
          <span className="font-mono font-black text-white text-sm tracking-wider">
            #{order.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
          <Clock size={11} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      {/* Customer info */}
      <div className="px-4 pt-3 pb-2 space-y-1.5">
        {order.customer_name && (
          <div className="flex items-center gap-2 text-zinc-300 text-xs">
            <User size={12} className="shrink-0 text-sky-400" />
            <span className="font-semibold">{order.customer_name}</span>
          </div>
        )}
        {order.customer_phone && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Phone size={12} className="shrink-0 text-emerald-400" />
            <span>{order.customer_phone}</span>
          </div>
        )}
        {order.delivery_address && (
          <div className="flex items-start gap-2 text-zinc-400 text-xs">
            <MapPin size={12} className="shrink-0 text-amber-400 mt-0.5" />
            <span className="leading-snug">
              {order.delivery_address}{order.delivery_postcode ? `, ${order.delivery_postcode}` : ''}
            </span>
          </div>
        )}
        {order.customer_notes && (
          <div className="flex items-start gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-2 py-1.5">
            <MessageSquare size={11} className="text-yellow-400 shrink-0 mt-0.5" />
            <span className="text-yellow-300 text-[11px] font-semibold leading-snug">{order.customer_notes}</span>
          </div>
        )}
      </div>

      {/* Driver note — directly below address */}
      <div className="px-4 py-2.5 border-t border-zinc-800">
        <div className="flex items-center gap-1.5 text-zinc-600 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
          <StickyNote size={10} />
          Driver Note
        </div>
        <textarea
          key={order.id}
          defaultValue={order.driver_notes ?? ''}
          onBlur={(e) => onNoteBlur(order.id, e.target.value)}
          placeholder="Gate code, special instructions…"
          rows={2}
          className="w-full bg-zinc-800/60 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-zinc-500 placeholder:text-zinc-700 leading-relaxed"
        />
      </div>

      {/* Order items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 space-y-1.5">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-zinc-300 leading-snug">
                  <span className="text-brand-red font-black">{item.quantity}×</span> {item.item_name ?? 'Item'}
                </span>
                <span className="text-[11px] text-zinc-500 tabular-nums shrink-0">
                  £{(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
              {(item.removals ?? []).length > 0 && (
                <p className="pl-3 text-[10px] font-black text-red-400 uppercase tracking-wide leading-snug">
                  NO {item.removals.join(' · NO ')}
                </p>
              )}
              {(item.extras ?? []).length > 0 && (
                <p className="pl-3 text-[10px] font-semibold text-emerald-400 leading-snug">
                  + {item.extras.map((e) => e.name).join(' · ')}
                </p>
              )}
              {item.notes && (
                <p className="pl-3 text-[10px] font-bold text-yellow-400 leading-snug">{item.notes}</p>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-2 mt-1">
            <span className="text-[11px] text-zinc-600">Total</span>
            <span className="text-sm font-black text-white">£{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 pb-3 space-y-2 border-t border-zinc-800 pt-2.5">
        {/* Driver assignment */}
        <select
          value={order.driver_id ?? ''}
          onChange={(e) => onAssign(order.id, e.target.value || null)}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-red"
        >
          <option value="">— Unassigned —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Priority (assigned only) */}
        {assigned && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs shrink-0">
              <Flag size={11} className="text-violet-400" />
              <span>Priority</span>
            </div>
            <select
              value={currentSeq}
              onChange={handlePriorityChange}
              className="ml-auto bg-zinc-800 border border-zinc-700 text-violet-300 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>Drop #{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-1.5 pt-0.5">
          {assigned && (
            <div className="flex gap-2">
              <button
                onClick={() => onDelivered(order.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black transition-colors"
              >
                <PackageCheck size={13} />
                Delivered
              </button>
              <button
                onClick={() => onFailed(order)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-black transition-colors"
              >
                <AlertCircle size={13} />
                Failed
              </button>
            </div>
          )}
          <button
            onClick={() => onSendBack(order.id)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-black border border-amber-500/20 transition-colors"
          >
            <AlertTriangle size={12} />
            ⚠️ Send Back to Prep
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dispatch page ─────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const { email } = usePermissions()

  const [board, setBoard]       = useState<BoardData>({ unassigned: [], drivers: [] })
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [failModal, setFailModal] = useState<DispatchOrder | null>(null)
  const [failReason, setFailReason] = useState('')

  // Header state
  const [now, setNow]                     = useState(new Date())
  const [mounted, setMounted]             = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const audioUnlockedRef                  = useRef(false)

  // Print state
  const [printOrder, setPrintOrder] = useState<DispatchOrder | null>(null)

  function playAlert() {
    if (!audioUnlockedRef.current) return
    try { new Audio(ALERT_URL).play() } catch { /* ignore */ }
  }

  function toggleAudio() {
    const next = !audioUnlockedRef.current
    audioUnlockedRef.current = next
    setAudioUnlocked(next)
  }

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Trigger window.print() when printOrder is set
  useEffect(() => {
    if (!printOrder) return
    const timer = setTimeout(() => {
      window.print()
      const reset = () => {
        setPrintOrder(null)
        window.removeEventListener('afterprint', reset)
      }
      window.addEventListener('afterprint', reset)
    }, 50)
    return () => clearTimeout(timer)
  }, [printOrder])

  const fetchBoard = useCallback(async () => {
    const res = await fetch('/api/admin/dispatch')
    if (!res.ok) { setError('Failed to load dispatch board'); setLoading(false); return }
    const data = await res.json()
    setBoard(data)
    setLoading(false)
    setError(null)
  }, [])

  useEffect(() => {
    fetchBoard()
    const channel = supabase
      .channel('dispatch-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as { status?: string }
        if (updated.status === 'ready') playAlert()
        fetchBoard()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchBoard])

  async function patch(body: Record<string, unknown>) {
    return fetch('/api/admin/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function handleAssign(orderId: string, driverId: string | null) {
    // Capture order data before board refreshes (needed for receipt)
    const orderForReceipt = driverId
      ? board.unassigned.find((o) => o.id === orderId) ?? null
      : null
    setUpdating(orderId)
    await patch({ order_id: orderId, driver_id: driverId })
    await fetchBoard()
    setUpdating(null)
    if (orderForReceipt && driverId) {
      setPrintOrder(orderForReceipt)
    }
  }

  async function handleSequence(orderId: string, seq: number): Promise<void> {
    setUpdating(orderId)
    await patch({ order_id: orderId, stop_sequence: seq })
    await fetchBoard()
    setUpdating(null)
  }

  async function handleDelivered(orderId: string) {
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'delivered' })
    toast.success('Marked as delivered')
    await fetchBoard()
    setUpdating(null)
  }

  async function handleFailedConfirm() {
    if (!failModal || !failReason.trim()) return
    const orderId = failModal.id
    setFailModal(null)
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'failed', failure_reason: failReason.trim() })
    toast.error('Order marked as failed')
    await fetchBoard()
    setUpdating(null)
    setFailReason('')
  }

  async function handleSendBack(orderId: string) {
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'send_back' })
    toast('Sent back to kitchen prep', { icon: '⚠️' })
    await fetchBoard()
    setUpdating(null)
  }

  async function handleNoteBlur(orderId: string, note: string) {
    await patch({ order_id: orderId, driver_notes: note })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  const allDrivers = board.drivers

  return (
    <div className="print:hidden p-6 lg:p-8 min-h-screen bg-zinc-950">

      {/* Premium KDS-style header */}
      <header className="flex items-center justify-between px-6 py-4 mb-8 border border-white/10 bg-[#111] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-red rounded-xl flex items-center justify-center">
            <Radio size={20} className="text-white" />
          </div>
          <div>
            <p className="font-black text-white text-base leading-none">Dispatch Controller</p>
            <p className="text-xs text-white/40 mt-0.5">Chicken Time Reigate · Auto-synced via Realtime</p>
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

          <button
            onClick={fetchBoard}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-xs font-bold transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
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

      {error && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Kanban board */}
      <div className="flex gap-5 overflow-x-auto pb-6">

        {/* Unassigned column */}
        <div className="w-72 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Unassigned</h2>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              {board.unassigned.length}
            </span>
          </div>
          <div className="space-y-3">
            {board.unassigned.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-700 text-sm text-center rounded-2xl border border-dashed border-zinc-800">
                <Truck size={28} className="mb-2 opacity-30" />
                No pending orders
              </div>
            ) : (
              board.unassigned.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  drivers={allDrivers}
                  onAssign={handleAssign}
                  onSequence={handleSequence}
                  onDelivered={handleDelivered}
                  onFailed={(o) => { setFailModal(o); setFailReason('') }}
                  onSendBack={handleSendBack}
                  onNoteBlur={handleNoteBlur}
                  updating={updating === order.id}
                />
              ))
            )}
          </div>
        </div>

        <div className="w-px bg-zinc-800 shrink-0" />

        {/* Driver columns */}
        {allDrivers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
            No active drivers
          </div>
        ) : (
          allDrivers.map((driver) => (
            <div key={driver.id} className="w-72 shrink-0">
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  driver.status === 'on_delivery' ? 'bg-emerald-400 animate-pulse' :
                  driver.status === 'available'   ? 'bg-sky-400' : 'bg-zinc-600'
                }`} />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">{driver.name}</h2>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${
                    driver.status === 'on_delivery' ? 'text-emerald-500' :
                    driver.status === 'available'   ? 'text-sky-500' : 'text-zinc-600'
                  }`}>{driver.status.replace('_', ' ')}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold shrink-0">
                  {driver.orders.length} stop{driver.orders.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {driver.orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-700 text-sm text-center rounded-2xl border border-dashed border-zinc-800">
                    <Truck size={28} className="mb-2 opacity-30" />
                    No assigned orders
                  </div>
                ) : (
                  driver.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      drivers={allDrivers}
                      onAssign={handleAssign}
                      onSequence={handleSequence}
                      onDelivered={handleDelivered}
                      onFailed={(o) => { setFailModal(o); setFailReason('') }}
                      onSendBack={handleSendBack}
                      onNoteBlur={handleNoteBlur}
                      updating={updating === order.id}
                    />
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fail reason modal */}
      {failModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-black text-white text-base">Mark as Failed</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Order #{failModal.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setFailModal(null)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-3">Reason for failure:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['No Answer', 'Wrong Address', 'Damaged', 'Refused'].map((r) => (
                <button
                  key={r}
                  onClick={() => setFailReason(r)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                    failReason === r
                      ? 'bg-red-500/30 border-red-500/50 text-red-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Or type a custom reason…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setFailModal(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFailedConfirm}
                disabled={!failReason.trim()}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-black transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <AlertCircle size={14} />
                Confirm Failed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
