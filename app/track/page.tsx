'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Clock, ChefHat, Package, Truck, Loader2 } from 'lucide-react'

interface OrderData {
  id: string
  status: string
  delivery_status: string | null
  total_amount: number
  created_at: string
  customer_name: string | null
  delivery_address: string | null
  order_items: Array<{ item_name: string | null; quantity: number; unit_price: number }>
}

const STEPS = [
  { label: 'Received',        icon: CheckCircle2 },
  { label: 'Preparing',       icon: ChefHat      },
  { label: 'Ready',           icon: Package       },
  { label: 'Out for Delivery', icon: Truck        },
  { label: 'Delivered',       icon: CheckCircle2  },
]

function getStep(status: string, delivery_status: string | null): number {
  if (delivery_status === 'delivered')       return 4
  if (delivery_status === 'out_for_delivery') return 3
  if (status === 'ready')                    return 2
  if (status === 'preparing')                return 1
  return 0
}

export default function TrackPage() {
  const [orderId, setOrderId]       = useState('')
  const [order, setOrder]           = useState<OrderData | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [autoRan, setAutoRan]       = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const lookup = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed')
      setOrder(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Magic link: auto-run from URL params
  useEffect(() => {
    if (autoRan) return
    const params = new URLSearchParams(window.location.search)
    const id  = params.get('id')?.trim()
    if (id) {
      setOrderId(id)
      setAutoRan(true)
      lookup(id)
    }
  }, [autoRan, lookup])

  // Poll every 15 seconds if order is active
  useEffect(() => {
    if (!order || !orderId) return
    const currentStep = getStep(order.status, order.delivery_status)
    if (currentStep === 4) return // delivered — stop polling

    const interval = setInterval(() => lookup(orderId), 15000)
    return () => clearInterval(interval)
  }, [order, orderId, lookup])

  const currentStep = order ? getStep(order.status, order.delivery_status) : -1
  const showForm = !autoRan || error

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId.trim()) return
    lookup(orderId.trim())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">

        <div>
          <a href="/order" className="text-sm text-brand-red font-semibold hover:underline">← Back to menu</a>
          <h1 className="font-heading font-black text-3xl text-brand-dark mt-2">Track Your Order</h1>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-heading font-bold text-base text-brand-dark mb-4">Find Your Order</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Order ID</label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Paste your Order ID here"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !orderId.trim()}
                className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Searching…</> : 'Track Order'}
              </button>
            </form>
          </div>
        )}

        {order && (
          <>
            {/* Progress bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading font-bold text-base text-brand-dark">Order Status</h2>
                {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                {lastRefresh && !loading && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="flex items-start">
                {STEPS.map((step, i) => {
                  const done   = i < currentStep
                  const active = i === currentStep
                  const future = i > currentStep
                  const Icon   = step.icon
                  return (
                    <div key={step.label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5 min-w-[52px]">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                          ${done   ? 'bg-emerald-500 text-white'                        : ''}
                          ${active ? 'bg-brand-red text-white ring-4 ring-brand-red/20' : ''}
                          ${future ? 'bg-gray-100 text-gray-400'                         : ''}`}>
                          {done
                            ? <CheckCircle2 size={16} />
                            : <Icon size={16} />
                          }
                        </div>
                        <span className={`text-[9px] font-semibold text-center leading-tight max-w-[52px]
                          ${active ? 'text-brand-red'   : ''}
                          ${done   ? 'text-emerald-600' : ''}
                          ${future ? 'text-gray-400'    : ''}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-5 mx-0.5 transition-all ${i < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {currentStep === 4 && (
                <div className="mt-4 text-center text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl py-2.5">
                  Your order has been delivered. Enjoy! 🍗
                </div>
              )}
            </div>

            {/* Order details */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h2 className="font-heading font-bold text-base text-brand-dark">Order Details</h2>
              {order.customer_name && (
                <p className="text-sm text-gray-600">For <span className="font-semibold text-gray-900">{order.customer_name}</span></p>
              )}
              {order.delivery_address && (
                <p className="text-sm text-gray-600">To <span className="font-medium text-gray-900">{order.delivery_address}</span></p>
              )}
              <div className="divide-y divide-gray-100">
                {order.order_items.map((item, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
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

            {/* Track another */}
            <button
              onClick={() => { setOrder(null); setAutoRan(false); setError(null) }}
              className="w-full text-sm text-gray-500 hover:text-brand-red transition-colors py-2"
            >
              Track a different order
            </button>
          </>
        )}

      </div>
    </div>
  )
}
