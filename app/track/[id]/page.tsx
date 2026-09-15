'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  CheckCircle2, ChefHat, Truck, Package, Clock, Loader2, AlertCircle, Calendar,
} from 'lucide-react'
import { formatTime } from '@/lib/utils/format-date'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderData {
  id:               string
  status:           string
  order_type:       string
  total_amount:     number
  scheduled_for:    string | null
  created_at:       string
  customer_name:    string | null
  delivery_address: string | null
  driver_id:        string | null
  driver_name:      string | null
  order_items:      Array<{ item_name: string | null; quantity: number; unit_price: number }>
}

// ─── Stepper config ───────────────────────────────────────────────────────────

interface Step { label: string; icon: React.ElementType; description?: string }

const DELIVERY_STEPS: Step[] = [
  { label: 'Order Received',    icon: CheckCircle2, description: 'We have your order' },
  { label: 'In the Kitchen',    icon: ChefHat,      description: 'Being prepared now' },
  { label: 'Out for Delivery',  icon: Truck,        description: 'On the way to you'  },
  { label: 'Delivered',         icon: CheckCircle2, description: 'Enjoy your meal!'   },
]

const COLLECTION_STEPS: Step[] = [
  { label: 'Order Received',       icon: CheckCircle2, description: 'We have your order' },
  { label: 'In the Kitchen',       icon: ChefHat,      description: 'Being prepared now' },
  { label: 'Ready for Collection', icon: Package,      description: 'Come collect it!'   },
  { label: 'Collected',            icon: CheckCircle2, description: 'See you next time!' },
]

function getStep(status: string, orderType: string): number {
  if (status === 'delivered' || status === 'collected') return 3
  if (orderType !== 'pickup') {
    if (status === 'dispatched') return 2
    if (status === 'preparing')  return 1
    return 0
  } else {
    if (status === 'ready')     return 2
    if (status === 'preparing') return 1
    // dispatched should not occur for pickup but show preparing as safe fallback
    if (status === 'dispatched') return 1
    return 0
  }
}

// ─── 404 state ────────────────────────────────────────────────────────────────

function OrderNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={32} className="text-red-400" />
      </div>
      <div>
        <h1 className="font-heading font-black text-2xl text-gray-900 mb-1">Order Not Found</h1>
        <p className="text-sm text-gray-500">This link may be invalid or the order doesn&apos;t exist.</p>
      </div>
      <a href="/order" className="text-sm text-brand-red font-semibold hover:underline">← Back to menu</a>
    </div>
  )
}

// ─── Stepper UI ───────────────────────────────────────────────────────────────

function Stepper({ steps, currentStep, driverName, orderType }: {
  steps: Step[]
  currentStep: number
  driverName: string | null
  orderType: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-heading font-bold text-base text-brand-dark mb-6">Order Status</h2>

      {/* Vertical stepper */}
      <div className="space-y-0">
        {steps.map((step, i) => {
          const done   = i < currentStep
          const active = i === currentStep
          const future = i > currentStep
          const Icon   = step.icon
          const isLast = i === steps.length - 1

          return (
            <div key={step.label} className="flex gap-4">
              {/* Icon + connector line */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all z-10
                  ${done   ? 'bg-emerald-500 text-white'                                                        : ''}
                  ${active ? 'bg-brand-red text-white ring-4 ring-brand-red/20 animate-pulse'                   : ''}
                  ${future ? 'bg-gray-100 text-gray-300'                                                        : ''}`}>
                  {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[32px] transition-colors ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>

              {/* Label + description */}
              <div className={`pb-6 pt-1.5 ${isLast ? 'pb-0' : ''}`}>
                <p className={`font-semibold text-sm leading-tight
                  ${done   ? 'text-emerald-600' : ''}
                  ${active ? 'text-brand-red'   : ''}
                  ${future ? 'text-gray-400'     : ''}`}>
                  {step.label}
                </p>
                {active && step.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
                {/* Driver name inline under "Out for Delivery" */}
                {active && i === 2 && orderType !== 'pickup' && driverName && (
                  <p className="text-xs font-semibold text-gray-700 mt-1 flex items-center gap-1">
                    <Truck size={11} className="text-brand-red" />
                    Driver: {driverName}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {currentStep === steps.length - 1 && (
        <div className="mt-4 text-center text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl py-3">
          {orderType === 'pickup' ? '🛍️ Order collected. Thanks for visiting!' : '🍗 Delivered. Enjoy your meal!'}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrackOrderPage() {
  const params    = useParams()
  const orderId   = typeof params.id === 'string' ? params.id : ''

  const [order,    setOrder]    = useState<OrderData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading,  setLoading]  = useState(true)

  // Track driver_id in ref so realtime handler can detect changes
  const driverIdRef = useRef<string | null>(null)

  const fetchOrder = useCallback(async () => {
    if (!orderId) return
    try {
      const res  = await fetch(`/api/track?id=${encodeURIComponent(orderId)}`)
      const data = await res.json()
      if (!res.ok) { setNotFound(true); return }
      setOrder(data)
      driverIdRef.current = data.driver_id ?? null  // driver_id now included in response
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  // Initial fetch
  useEffect(() => { fetchOrder() }, [fetchOrder])

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as { status?: string; driver_id?: string | null }
          // Guard: postgres_changes sends full row but status could be missing in edge configs
          if (updated.status) {
            setOrder((prev) => prev ? { ...prev, status: updated.status! } : prev)
          }
          // Re-fetch full order if driver_id changed (to get driver_name)
          if (updated.driver_id !== driverIdRef.current) {
            driverIdRef.current = updated.driver_id ?? null
            fetchOrder()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, fetchOrder])

  // ── Derived state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm font-medium">Loading order…</p>
        </div>
      </div>
    )
  }

  if (notFound || !order) return <OrderNotFound />

  const isDelivery   = order.order_type !== 'pickup'
  const steps        = isDelivery ? DELIVERY_STEPS : COLLECTION_STEPS
  const currentStep  = getStep(order.status, order.order_type)

  // Scheduled banner: show if scheduled_for is more than 1 minute in the future
  const isScheduledFuture = order.scheduled_for
    ? new Date(order.scheduled_for).getTime() > Date.now() + 60 * 1000
    : false

  const scheduledLabel = order.scheduled_for
    ? new Date(order.scheduled_for).toLocaleTimeString('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-5">

        {/* Header */}
        <div>
          <a href="/order" className="text-sm text-brand-red font-semibold hover:underline">← Back to menu</a>
          <h1 className="font-heading font-black text-3xl text-brand-dark mt-2">Track Your Order</h1>
          {order.customer_name && (
            <p className="text-sm text-gray-500 mt-1">For <span className="font-semibold text-gray-700">{order.customer_name}</span></p>
          )}
        </div>

        {/* Scheduled banner */}
        {isScheduledFuture && scheduledLabel && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800">
            <Calendar size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-bold text-sm">Scheduled for {scheduledLabel}</p>
              <p className="text-xs mt-0.5 text-amber-700">We will start preparing your order closer to this time.</p>
            </div>
          </div>
        )}

        {/* Order type badge */}
        <div className="flex items-center gap-2">
          {isDelivery ? (
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold rounded-full px-3 py-1">
              <Truck size={11} /> Delivery
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold rounded-full px-3 py-1">
              <Package size={11} /> Collection
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={10} />
            Placed {formatTime(order.created_at)}
          </span>
        </div>

        {/* Stepper */}
        <Stepper
          steps={steps}
          currentStep={currentStep}
          driverName={order.driver_name}
          orderType={order.order_type}
        />

        {/* Delivery address */}
        {isDelivery && order.delivery_address && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Delivering to</p>
            <p className="text-sm font-medium text-gray-800">{order.delivery_address}</p>
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark">Your Order</h2>
          <div className="divide-y divide-gray-100">
            {order.order_items.map((item, i) => (
              <div key={i} className="flex justify-between py-2.5 text-sm">
                <span className="font-medium text-gray-800">{item.quantity}× {item.item_name ?? 'Item'}</span>
                <span className="text-gray-500">£{(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>£{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-gray-400">
          Having issues?{' '}
          <a href="/track" className="text-brand-red font-semibold hover:underline">
            Look up a different order
          </a>
        </p>

      </div>
    </div>
  )
}
