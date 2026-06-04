'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MapPin, AlertCircle, Loader2, ShoppingCart } from 'lucide-react'

interface CartItem {
  name: string
  price: number
  quantity: number
  totalPrice: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes?: string
}

interface DeliveryZone {
  id: string
  postcode_prefix: string
  delivery_fee: number
  min_order_amount: number
  is_active: boolean
}

export default function CheckoutPage() {
  const [cartItems, setCartItems]       = useState<CartItem[]>([])
  const [postcode, setPostcode]         = useState('')
  const [zone, setZone]                 = useState<DeliveryZone | null>(null)
  const [zoneError, setZoneError]       = useState<string | null>(null)
  const [zoneLoading, setZoneLoading]   = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingCart')
      if (raw) setCartItems(JSON.parse(raw))
    } catch {
      // ignore corrupt storage
    }
  }, [])

  const subtotal = cartItems.reduce((s, i) => s + i.totalPrice, 0)
  const deliveryFee = zone ? Number(zone.delivery_fee) : 0
  const total = subtotal + deliveryFee

  function handlePostcodeChange(val: string) {
    setPostcode(val)
    setZone(null)
    setZoneError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = val.trim()
    if (!trimmed) return
    debounceRef.current = setTimeout(() => validatePostcode(trimmed), 600)
  }

  async function validatePostcode(pc: string) {
    setZoneLoading(true)
    setZoneError(null)
    try {
      const res = await fetch(`/api/delivery-zones?postcode=${encodeURIComponent(pc)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to check postcode')
      if (data.zone) {
        if (data.zone.min_order_amount > 0 && subtotal < data.zone.min_order_amount) {
          setZoneError(`Minimum order £${Number(data.zone.min_order_amount).toFixed(2)} for your area (you have £${subtotal.toFixed(2)})`)
          setZone(null)
        } else {
          setZone(data.zone)
        }
      } else {
        setZoneError('Sorry, we don\'t deliver to that postcode yet.')
        setZone(null)
      }
    } catch (err) {
      setZoneError(err instanceof Error ? err.message : 'Error checking postcode')
      setZone(null)
    } finally {
      setZoneLoading(false)
    }
  }

  async function handlePay() {
    if (!zone || cartItems.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems,
          delivery_fee: deliveryFee,
          postcode: postcode.trim().toUpperCase(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      sessionStorage.removeItem('pendingCart')
      window.location.href = data.url
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-gray-400 p-8">
        <ShoppingCart size={48} className="opacity-20" />
        <p className="text-base font-medium">No items in your order.</p>
        <a href="/order" className="text-brand-red font-semibold text-sm hover:underline">← Back to menu</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div>
          <a href="/order" className="text-sm text-brand-red font-semibold hover:underline">← Back to menu</a>
          <h1 className="font-heading font-black text-3xl text-brand-dark mt-2">Checkout</h1>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark">Order Summary</h2>
          <div className="divide-y divide-gray-100">
            {cartItems.map((item, i) => (
              <div key={i} className="flex justify-between py-2.5 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">{item.quantity}× {item.name}</span>
                  {item.extras.length > 0 && (
                    <p className="text-xs text-gray-400">{item.extras.map((e) => `+ ${e.name}`).join(', ')}</p>
                  )}
                  {item.removals.length > 0 && (
                    <p className="text-xs text-brand-red">{item.removals.join(', ')}</p>
                  )}
                </div>
                <span className="font-semibold text-gray-900 shrink-0 ml-4">£{item.totalPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark flex items-center gap-2">
            <MapPin size={16} className="text-brand-red" />
            Delivery Postcode
          </h2>
          <input
            type="text"
            value={postcode}
            onChange={(e) => handlePostcodeChange(e.target.value)}
            placeholder="e.g. RH2 8AB"
            maxLength={8}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red uppercase"
          />

          {zoneLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Checking postcode…
            </div>
          )}

          {zoneError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {zoneError}
            </div>
          )}

          {zone && (
            <div className="flex items-center justify-between text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
              <span className="font-semibold">✓ We deliver to {postcode.trim().toUpperCase()}</span>
              <span className="font-bold">
                {deliveryFee === 0 ? 'Free delivery' : `£${deliveryFee.toFixed(2)} delivery`}
              </span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Delivery</span>
            <span>{zone ? (deliveryFee === 0 ? 'Free' : `£${deliveryFee.toFixed(2)}`) : '—'}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{zone ? `£${total.toFixed(2)}` : '—'}</span>
          </div>
        </div>

        {/* Pay button */}
        {submitError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!zone || submitting || cartItems.length === 0}
          className="w-full bg-brand-red hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/20"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
            : <><span>Pay {zone ? `£${total.toFixed(2)}` : ''}</span><ChevronRight size={16} /></>
          }
        </button>
      </div>
    </div>
  )
}
