'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  MapPin, Phone, MessageSquare, Truck, CheckCircle,
  Loader2, RefreshCw, LogOut, User, StickyNote, AlertCircle,
} from 'lucide-react'

interface Order {
  id: string
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  customer_notes: string | null
  driver_notes: string | null
  total_amount: number
  created_at: string
  stop_sequence: number
}

function mapsUrl(address: string | null, postcode: string | null) {
  const dest = [address, postcode].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}

function multiStopMapsUrl(orders: Order[]) {
  if (orders.length === 0) return null
  const stops = orders.map((o) =>
    [o.delivery_address, o.delivery_postcode].filter(Boolean).join(', '),
  )
  if (stops.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stops[0])}`
  const destination = encodeURIComponent(stops[stops.length - 1])
  const waypoints = stops.slice(0, -1).map(encodeURIComponent).join('|')
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}`
}

export default function DriverDashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ id: string; msg: string } | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState<string | null>(null)
  const [returnModal, setReturnModal] = useState<string | null>(null) // orderId
  const [returnReason, setReturnReason] = useState('')

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/driver/orders')
    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 403) { setAccessDenied(true); setLoading(false); return }
    if (res.ok) {
      const data = await res.json()
      setOrders(
        (data.orders ?? []).slice().sort(
          (a: Order, b: Order) => (a.stop_sequence ?? 1) - (b.stop_sequence ?? 1),
        ),
      )
      setDriverId((prev) => prev ?? (data.driver_id as string | null) ?? null)
      setDriverName((prev) => prev ?? (data.driver_name as string | null) ?? null)
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Dedicated subscription effect — must bind .on() BEFORE .subscribe()
  useEffect(() => {
    if (!driverId) return
    const channel = supabase
      .channel(`driver-orders-${driverId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `driver_id=eq.${driverId}`,
      }, () => { fetchOrders() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [driverId, fetchOrders])

  async function handleAction(orderId: string, action: 'delivered' | 'return_to_kitchen', return_reason?: string) {
    setUpdating(orderId)
    const res = await fetch(`/api/driver/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(return_reason ? { return_reason } : {}) }),
    })
    if (res.ok) {
      const msg = action === 'delivered' ? '✅ Marked as delivered!' : '↩️ Returned to kitchen'
      setFlash({ id: orderId, msg })
      setTimeout(() => setFlash(null), 2500)
      await fetchOrders()
    }
    setUpdating(null)
  }

  async function handleReturnConfirm() {
    if (!returnModal || !returnReason.trim()) return
    const orderId = returnModal
    setReturnModal(null)
    await handleAction(orderId, 'return_to_kitchen', returnReason.trim())
    setReturnReason('')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Truck className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Not a Driver</h1>
          <p className="text-zinc-400 text-lg">Your account is not linked to a driver profile. Contact your manager.</p>
          <button
            onClick={handleSignOut}
            className="mt-8 flex items-center gap-3 mx-auto px-8 py-4 rounded-2xl bg-zinc-800 text-white font-bold text-lg active:bg-zinc-700"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 text-white overflow-auto">
      <div className="max-w-md mx-auto px-4 pb-10">

        {/* Header */}
        <header className="flex items-center justify-between py-5 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-red rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-black text-white text-lg leading-none">
                {driverName ?? 'Driver'}
              </p>
              <p className="text-sm text-zinc-500 mt-0.5">Chicken Time Reigate</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="w-11 h-11 rounded-2xl bg-zinc-800 active:bg-zinc-700 flex items-center justify-center"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-zinc-300" />
            </button>
            <button
              onClick={handleSignOut}
              className="w-11 h-11 rounded-2xl bg-zinc-800 active:bg-zinc-700 flex items-center justify-center"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 text-zinc-300" />
            </button>
          </div>
        </header>

        {/* Flash message */}
        {flash && (
          <div className="mt-4 px-5 py-4 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 font-bold text-lg text-center">
            {flash.msg}
          </div>
        )}

        {/* Deliveries */}
        <div className="mt-5">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">
            Active Deliveries ({orders.length})
          </p>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mb-5">
                <Truck className="w-10 h-10 text-zinc-600" />
              </div>
              <p className="text-zinc-300 font-black text-2xl">No active deliveries</p>
              <p className="text-zinc-600 text-base mt-2">You&apos;re all clear. Check back soon.</p>
              <button
                onClick={fetchOrders}
                className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 active:bg-zinc-700 text-zinc-300 font-bold text-base"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          ) : (
            <>
              {/* Multi-stop route button */}
              {(() => {
                const routeUrl = multiStopMapsUrl(orders)
                return routeUrl ? (
                  <a
                    href={routeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-violet-600 active:bg-violet-500 text-white font-black text-xl tracking-wide shadow-lg shadow-violet-900/40 mb-5"
                  >
                    🗺️ Map Entire Route ({orders.length} stops)
                  </a>
                ) : null
              })()}

              <div className="space-y-5">
                {orders.map((order, idx) => (
                  <div key={order.id} className={`bg-zinc-900 rounded-3xl overflow-hidden shadow-xl ${idx === 0
                    ? 'border-2 border-emerald-500 shadow-emerald-900/30'
                    : 'border border-zinc-700'
                    }`}>

                    {/* NEXT DROP banner */}
                    {idx === 0 && (
                      <div className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 text-black font-black text-sm tracking-widest uppercase">
                        ⚡ NEXT DROP — Priority 1
                      </div>
                    )}

                    {/* Order header */}
                    <div className="flex items-center justify-between px-5 py-4 bg-zinc-800/50 border-b border-zinc-700">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-xs ${idx === 0 ? 'bg-emerald-500' : 'bg-violet-600'
                            }`}>
                            {order.stop_sequence ?? idx + 1}
                          </span>
                          <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Order Ref</p>
                        </div>
                        <p className="font-mono font-black text-white text-2xl tracking-wider">
                          #{order.id.slice(-6).toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Total</p>
                        <p className="font-black text-white text-2xl">£{Number(order.total_amount).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Customer info */}
                    <div className="px-5 py-5 space-y-4">

                      {order.customer_name && (
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sky-500/15 rounded-2xl flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-sky-400" />
                          </div>
                          <p className="text-white font-black text-2xl leading-tight">{order.customer_name}</p>
                        </div>
                      )}

                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-4 active:opacity-60"
                        >
                          <div className="w-12 h-12 bg-emerald-500/15 rounded-2xl flex items-center justify-center shrink-0">
                            <Phone className="w-6 h-6 text-emerald-400" />
                          </div>
                          <p className="text-emerald-400 font-black text-2xl tracking-wide">
                            {order.customer_phone}
                          </p>
                        </a>
                      )}

                      {order.delivery_address && (
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-amber-500/15 rounded-2xl flex items-center justify-center shrink-0 mt-1">
                            <MapPin className="w-6 h-6 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-white font-bold text-lg leading-snug">{order.delivery_address}</p>
                            {order.delivery_postcode && (
                              <p className="text-amber-300 font-black text-2xl tracking-widest uppercase mt-1">
                                {order.delivery_postcode}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {order.customer_notes && (
                        <div className="flex items-start gap-4 bg-yellow-400/10 border border-yellow-400/25 rounded-2xl px-4 py-4">
                          <MessageSquare className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                          <p className="text-yellow-300 font-bold text-lg leading-snug">{order.customer_notes}</p>
                        </div>
                      )}

                      {order.driver_notes && (
                        <div className="flex items-start gap-4 bg-yellow-400/15 border-2 border-yellow-400 rounded-2xl px-4 py-4">
                          <StickyNote className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-1">Note</p>
                            <p className="text-yellow-200 font-bold text-lg leading-snug">{order.driver_notes}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="px-5 pb-5 space-y-3">

                      {/* Navigate */}
                      <a
                        href={mapsUrl(order.delivery_address, order.delivery_postcode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 w-full py-6 rounded-2xl bg-sky-500 active:bg-sky-400 text-white font-black text-2xl tracking-wide shadow-lg shadow-sky-900/40"
                      >
                        🗺️ Navigate
                      </a>

                      {/* Mark Delivered — full-width primary CTA */}
                      <button
                        onClick={() => handleAction(order.id, 'delivered')}
                        disabled={updating === order.id}
                        className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl bg-emerald-500 active:bg-emerald-400 text-white font-black text-2xl tracking-wide shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === order.id ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-7 h-7" />
                            <span>Mark Delivered</span>
                          </>
                        )}
                      </button>

                      {/* Report Issue — smaller secondary */}
                      <button
                        onClick={() => { setReturnModal(order.id); setReturnReason('') }}
                        disabled={updating === order.id}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/20 border-2 border-red-500/40 active:bg-red-500/30 text-red-400 font-black text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === order.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5" />
                            <span>⚠️ Report Issue / Failed</span>
                          </>
                        )}
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Return reason modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-black text-white text-lg">Why returning?</p>
                <p className="text-sm text-zinc-500 mt-0.5">Select a reason before sending back</p>
              </div>
              <button
                onClick={() => setReturnModal(null)}
                className="p-2 rounded-xl text-zinc-500 active:bg-zinc-800 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {['Damaged', 'No Customer Answer', 'Customer Return', 'Refused Delivery'].map((r) => (
                <button
                  key={r}
                  onClick={() => setReturnReason(r)}
                  className={`py-4 rounded-2xl text-sm font-black transition-colors border ${returnReason === r
                    ? 'bg-red-500/30 border-red-500/50 text-red-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 active:bg-zinc-700'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Or type your own reason…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-4 text-white text-base placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setReturnModal(null)}
                className="flex-1 py-5 rounded-2xl border border-zinc-700 text-zinc-400 font-black text-lg active:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnConfirm}
                disabled={!returnReason.trim()}
                className="flex-1 py-5 rounded-2xl bg-red-500 active:bg-red-400 text-white font-black text-lg disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-5 h-5" />
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
