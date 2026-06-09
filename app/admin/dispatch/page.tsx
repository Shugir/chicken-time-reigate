'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { usePermissions } from '@/components/admin/permissions-provider'
import toast from 'react-hot-toast'
import {
  Radio, RefreshCw, Loader2, Truck, MapPin, User, Clock,
  AlertCircle, Flag, PackageCheck, AlertTriangle, Phone,
  MessageSquare, StickyNote, ArrowLeft, ChefHat, Search, X, Printer,
  ChevronRight,
} from 'lucide-react'
import {
  formatTimeFull, formatDateClockLabel,
} from '@/lib/utils/format-date'
import { orderUrgency } from '@/lib/utils/order-urgency'
import { CustomerReceipt } from '@/components/CustomerReceipt'

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
  return_reason?: string | null
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
  returned: DispatchOrder[]  // ADD THIS
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
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
  onThermalPrint,
  updating,
  isInbox,
}: {
  order: DispatchOrder
  drivers: DispatchDriver[]
  onAssign: (orderId: string, driverId: string | null) => void
  onSequence: (orderId: string, seq: number) => Promise<void>
  onDelivered: (orderId: string) => void
  onFailed: (order: DispatchOrder) => void
  onSendBack: (orderId: string) => void
  onNoteBlur: (orderId: string, note: string) => void
  onThermalPrint: (orderId: string) => void
  updating: boolean
  isInbox?: boolean
}) {
  const assigned = !!order.driver_id
  const currentSeq = order.stop_sequence ?? 1
  const urgency = orderUrgency(order.created_at)

  const urgencyBorder = urgency === 'critical' ? 'border-red-500/60' :
    urgency === 'warning' ? 'border-amber-500/50' :
    assigned ? 'border-zinc-700' : 'border-zinc-700/60'

  const timeColor = urgency === 'critical' ? 'text-red-400' :
    urgency === 'warning' ? 'text-amber-400' : 'text-zinc-500'

  async function handlePriorityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const seq = Number(e.target.value)
    await onSequence(order.id, seq)
    toast.success(`Priority updated to Drop #${seq}`, { duration: 2000 })
  }

  return (
    <div className={`rounded-2xl border bg-zinc-900 overflow-hidden shadow-md transition-all ${updating ? 'opacity-60 pointer-events-none' : ''} ${urgencyBorder}`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-zinc-800 ${urgency === 'critical' ? 'bg-red-950/30' : urgency === 'warning' ? 'bg-amber-950/20' : 'bg-zinc-800/40'}`}>
        <div className="flex items-center gap-2">
          {assigned && (
            <span className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-[11px]">
              {currentSeq}
            </span>
          )}
          <span className="font-mono font-black text-white text-sm tracking-wider">
            #{order.id.slice(-6).toUpperCase()}
          </span>
          <button
            onClick={() => onThermalPrint(order.id)}
            title="Thermal Print"
            className="p-1.5 rounded-lg bg-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <Printer size={13} />
          </button>
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${timeColor}`}>
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
        {order.return_reason && (
          <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
            <AlertTriangle size={11} className="text-red-400 shrink-0 mt-0.5" />
            <span className="text-red-300 text-[11px] font-bold leading-snug">Returned: {order.return_reason}</span>
          </div>
        )}
      </div>

      {/* Driver note */}
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
        {/* Driver assignment — prominent in inbox mode */}
        {isInbox ? (
          <div>
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <ChevronRight size={10} className="text-brand-red" />
              Assign Driver
            </div>
            <select
              value={order.driver_id ?? ''}
              onChange={(e) => onAssign(order.id, e.target.value || null)}
              className="w-full bg-brand-red/10 border-2 border-brand-red/50 text-white text-sm font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-red cursor-pointer hover:border-brand-red/80 transition-colors"
            >
              <option value="" className="bg-zinc-900 text-zinc-100 font-normal">— Select Driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id} className="bg-zinc-900 text-zinc-100 font-normal">{d.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <select
            value={order.driver_id ?? ''}
            onChange={(e) => onAssign(order.id, e.target.value || null)}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-red"
          >
            <option value="" className="bg-zinc-800 text-zinc-200">— Unassigned —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} className="bg-zinc-800 text-zinc-200">{d.name}</option>
            ))}
          </select>
        )}

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

// ── Returned order card ───────────────────────────────────────────────────────

function ReturnedCard({
  order,
  drivers,
  onRemake,
  onAssign,
  onHold,
  onCancel,
  updating,
}: {
  order: DispatchOrder
  drivers: DispatchDriver[]
  onRemake: (id: string) => void
  onAssign: (orderId: string, driverId: string | null) => void
  onHold: (id: string) => void
  onCancel: (order: DispatchOrder) => void
  updating: boolean
}) {
  const isOnHold = order.delivery_status === 'on_hold'
  return (
    <div className={`rounded-2xl border overflow-hidden shadow-md transition-all ${updating ? 'opacity-60 pointer-events-none' : ''} border-amber-500/40 bg-zinc-900`}>
      <div className="flex items-center justify-between px-4 py-3 bg-amber-950/30 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-white text-sm tracking-wider">#{order.id.slice(-6).toUpperCase()}</span>
          {isOnHold && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400 text-[10px] font-bold uppercase tracking-wide">On Hold</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
          <Clock size={11} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      {order.return_reason && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-red-400 shrink-0" />
          <span className="text-red-300 text-xs font-bold">{order.return_reason}</span>
        </div>
      )}

      <div className="px-4 pt-2 pb-2 space-y-1">
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
            <span className="leading-snug">{order.delivery_address}{order.delivery_postcode ? `, ${order.delivery_postcode}` : ''}</span>
          </div>
        )}
      </div>

      <div className="mx-4 mb-3 flex items-center justify-between border-t border-zinc-800 pt-2">
        <span className="text-[11px] text-zinc-600">Total</span>
        <span className="text-sm font-black text-white">£{Number(order.total_amount).toFixed(2)}</span>
      </div>

      <div className="px-4 pb-3 space-y-2 border-t border-zinc-800 pt-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <ChevronRight size={10} className="text-violet-400" />
            Reassign Driver
          </div>
          <select
            value={order.driver_id ?? ''}
            onChange={(e) => onAssign(order.id, e.target.value || null)}
            className="w-full bg-violet-500/10 border-2 border-violet-500/40 text-white text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="" className="bg-zinc-900 text-zinc-100 font-normal">— Select Driver —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id} className="bg-zinc-900 text-zinc-100 font-normal">{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onRemake(order.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 text-xs font-black transition-colors"
          >
            <ChefHat size={13} />
            Remake
          </button>
          <button
            onClick={() => onHold(order.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-colors border ${isOnHold ? 'bg-zinc-700 border-zinc-600 text-zinc-300' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-400'}`}
          >
            <Phone size={13} />
            {isOnHold ? 'Holding' : 'Hold'}
          </button>
        </div>

        <button
          onClick={() => onCancel(order)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black border border-red-500/20 transition-colors"
        >
          <X size={12} />
          Cancel Order
        </button>
      </div>
    </div>
  )
}

// ── Dispatch page ─────────────────────────────────────────────────────────────

export default function DispatchPage() {
  const { email } = usePermissions()

  const [board, setBoard] = useState<BoardData>({ unassigned: [], drivers: [], returned: [] })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failModal, setFailModal] = useState<DispatchOrder | null>(null)
  const [failReason, setFailReason] = useState('')
  const [cancelModal, setCancelModal] = useState<DispatchOrder | null>(null)

  const [query, setQuery] = useState('')
  const [driverFilter, setDriverFilter] = useState<'all' | 'on_delivery' | 'available'>('all')

  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const audioUnlockedRef = useRef(false)

  const [printOrder, setPrintOrder] = useState<DispatchOrder | null>(null)

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

  async function handleRemake(orderId: string) {
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'remake' })
    toast.success('Sent to kitchen for remake')
    await fetchBoard()
    setUpdating(null)
  }

  async function handleHold(orderId: string) {
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'hold' })
    toast('Order held — contact customer', { icon: '📞' })
    await fetchBoard()
    setUpdating(null)
  }

  async function handleCancelConfirm() {
    if (!cancelModal) return
    const orderId = cancelModal.id
    setCancelModal(null)
    setUpdating(orderId)
    await patch({ order_id: orderId, action: 'cancel' })
    toast.error('Order cancelled')
    await fetchBoard()
    setUpdating(null)
  }

  async function handleNoteBlur(orderId: string, note: string) {
    await patch({ order_id: orderId, driver_notes: note })
  }

  async function handleThermalPrint(orderId: string) {
    const t = toast.loading('Sending to thermal printer...')
    try {
      const res = await fetch('/api/admin/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Print sent successfully', { id: t })
      } else {
        toast.error(data.error || 'Print failed', { id: t })
      }
    } catch {
      toast.error('Could not connect to printer', { id: t })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  const allDrivers = board.drivers
  const q = query.trim().toLowerCase()

  function orderMatches(o: DispatchOrder) {
    if (!q) return true
    return [
      o.id.slice(-6), o.customer_name, o.customer_phone,
      o.delivery_address, o.delivery_postcode,
    ].some((v) => (v ?? '').toString().toLowerCase().includes(q))
  }

  function driverMatches(d: DispatchDriver) {
    if (driverFilter !== 'all' && d.status !== driverFilter) return false
    if (!q) return true
    return d.name.toLowerCase().includes(q) || d.orders.some(orderMatches)
  }

  const visibleDrivers = allDrivers.filter(driverMatches)
  const visibleUnassigned = board.unassigned.filter(orderMatches)
  const onDeliveryCount = allDrivers.filter((d) => d.status === 'on_delivery').length
  const availableCount = allDrivers.filter((d) => d.status === 'available').length

  const filterChips = [
    { key: 'all' as const, label: 'All', count: allDrivers.length },
    { key: 'on_delivery' as const, label: 'On Delivery', count: onDeliveryCount },
    { key: 'available' as const, label: 'Available', count: availableCount },
  ]

  return (
    <>
      {/* Full-screen dispatch shell */}
      <div className="print:hidden fixed inset-0 z-10 bg-zinc-950 flex flex-col overflow-hidden">

        {/* KDS Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 mx-4 mt-4 mb-3 border border-white/10 bg-[#111] rounded-2xl gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand-red rounded-xl flex items-center justify-center shrink-0">
              <Radio size={18} className="text-white" />
            </div>
            <div>
              <p className="font-black text-white text-sm sm:text-base leading-none whitespace-nowrap">Dispatch Controller</p>
              <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 hidden sm:block whitespace-nowrap">Chicken Time Reigate · Auto-synced via Realtime</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {email && (
              <div className="text-right hidden lg:block">
                <p className="text-[10px] text-white/30 leading-none">Signed in</p>
                <p className="text-xs text-white/60 font-medium leading-tight mt-0.5 max-w-[140px] truncate">{email}</p>
              </div>
            )}

            <Link
              href="/admin"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-xs font-bold transition-colors"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back to Admin</span>
            </Link>

            <Link
              href="/kitchen"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-xs font-bold transition-colors"
            >
              <ChefHat size={13} />
              Back to Kitchen
            </Link>

            <button
              onClick={fetchBoard}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white text-xs font-bold transition-colors"
            >
              <RefreshCw size={13} />
              Refresh
            </button>

            <button
              onClick={fetchBoard}
              className="sm:hidden p-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={14} />
            </button>

            <div className="text-right hidden sm:block">
              <p className="font-mono font-bold text-white text-lg sm:text-xl tabular-nums">
                {mounted ? formatTimeFull(now) : ''}
              </p>
              <p className="text-xs text-white/40 font-mono">
                {mounted ? formatDateClockLabel(now) : ''}
              </p>
            </div>
          </div>
        </header>

        {/* Content below header — flex col, takes remaining height */}
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden px-4 pb-4">

          {error && (
            <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm shrink-0">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Search + filter + stats bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 shrink-0">
            <div className="relative flex-1 sm:max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search driver, order #, customer, postcode…"
                className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-xl pl-10 pr-9 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-brand-red/60 focus:ring-1 focus:ring-brand-red/40 transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#111] border border-white/10 rounded-xl p-1 overflow-x-auto shrink-0">
              {filterChips.map((f) => {
                const active = driverFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setDriverFilter(f.key)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${active
                      ? 'bg-brand-red text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {f.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${active ? 'bg-black/25 text-white' : 'bg-white/5 text-zinc-500'
                      }`}>
                      {f.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Stats inline */}
            <div className="flex gap-2 shrink-0">
              <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${board.unassigned.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                <span className={`text-lg font-black tabular-nums leading-none ${board.unassigned.length > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{board.unassigned.length}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Inbox</span>
              </div>
              <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${onDeliveryCount > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                <span className={`text-lg font-black tabular-nums leading-none ${onDeliveryCount > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>{onDeliveryCount}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Out</span>
              </div>
              <div className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${availableCount > 0 ? 'bg-sky-500/10 border-sky-500/20' : 'bg-zinc-900 border-zinc-800'}`}>
                <span className={`text-lg font-black tabular-nums leading-none ${availableCount > 0 ? 'text-sky-400' : 'text-zinc-500'}`}>{availableCount}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Free</span>
              </div>
            </div>
          </div>

          {/* ── Split-pane dispatch grid ─────────────────────────────────────── */}
          <div className="flex flex-row gap-4 flex-1 min-h-0">

            {/* LEFT PANE — Inbox (Unassigned) */}
            <div className="w-[350px] shrink-0 flex flex-col h-full bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
              {/* Pane header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800 shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Inbox</h2>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold tabular-nums">
                  {board.unassigned.length}
                </span>
              </div>
              {/* Scrollable cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {board.unassigned.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-700 text-sm text-center rounded-2xl border border-dashed border-zinc-800">
                    <Truck size={28} className="mb-2 opacity-30" />
                    No pending orders
                  </div>
                ) : visibleUnassigned.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-700 text-sm text-center rounded-2xl border border-dashed border-zinc-800">
                    <Search size={24} className="mb-2 opacity-30" />
                    No matching orders
                  </div>
                ) : (
                  visibleUnassigned.map((order) => (
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
                      onThermalPrint={handleThermalPrint}
                      updating={updating === order.id}
                      isInbox
                    />
                  ))
                )}

                {/* Returned orders */}
                {board.returned.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 px-1 py-2 mb-2">
                      <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                      <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Returned</h3>
                      <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">{board.returned.length}</span>
                    </div>
                    <div className="space-y-3">
                      {board.returned.map((order) => (
                        <ReturnedCard
                          key={order.id}
                          order={order}
                          drivers={allDrivers}
                          onRemake={handleRemake}
                          onAssign={handleAssign}
                          onHold={handleHold}
                          onCancel={(o) => setCancelModal(o)}
                          updating={updating === order.id}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE — Fleet (Driver columns, horizontal scroll) */}
            <div className="flex-1 flex overflow-x-auto gap-4 h-full pb-2">
              {allDrivers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
                  No active drivers
                </div>
              ) : visibleDrivers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-700 text-sm text-center">
                  <Search size={28} className="mb-2 opacity-30" />
                  No drivers match your search
                </div>
              ) : (
                visibleDrivers.map((driver) => (
                  <div key={driver.id} className="min-w-[300px] w-[300px] shrink-0 flex flex-col h-full bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                    {/* Driver column header */}
                    <div className="flex items-center gap-2.5 px-3 py-3 border-b border-zinc-800 shrink-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${driver.status === 'on_delivery' ? 'bg-emerald-400 animate-pulse' :
                        driver.status === 'available' ? 'bg-sky-400' : 'bg-zinc-600'
                        }`} />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-white truncate">{driver.name}</h2>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest ${driver.status === 'on_delivery' ? 'text-emerald-500' :
                          driver.status === 'available' ? 'text-sky-500' : 'text-zinc-600'
                          }`}>{driver.status.replace('_', ' ')}</p>
                      </div>
                      {driver.phone && (
                        <a href={`tel:${driver.phone}`} className="text-[10px] text-zinc-600 hover:text-emerald-400 font-mono tabular-nums transition-colors shrink-0" title="Call driver">
                          {driver.phone}
                        </a>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold shrink-0 tabular-nums">
                        {driver.orders.length}
                      </span>
                    </div>
                    {/* Scrollable order list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                            onThermalPrint={handleThermalPrint}
                            updating={updating === order.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cancel order confirm modal */}
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-black text-white text-base">Cancel Order?</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Order #{cancelModal.id.slice(-6).toUpperCase()}</p>
                </div>
                <button onClick={() => setCancelModal(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">✕</button>
              </div>
              <p className="text-sm text-zinc-400 mb-5">This will permanently cancel the order. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setCancelModal(null)} className="flex-1 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-sm font-bold transition-colors">Keep</button>
                <button onClick={handleCancelConfirm} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-black transition-colors flex items-center justify-center gap-2">
                  <X size={14} />
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        )}

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
                {['Damaged', 'No Customer Answer', 'Customer Return', 'Refused'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFailReason(r)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-colors border ${failReason === r
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

      {/* Customer receipt — printed on driver assign */}
      {printOrder && <CustomerReceipt order={printOrder} />}
    </>
  )
}
