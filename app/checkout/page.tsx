'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MapPin, AlertCircle, Loader2, ShoppingCart, Tag, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
  const [promoCode, setPromoCode]       = useState('')
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_type: 'flat' | 'percentage'; discount_value: number; discount_amount: number } | null>(null)
  const [promoError, setPromoError]     = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  const [customerName, setCustomerName]                 = useState('')
  const [customerPhone, setCustomerPhone]               = useState('')
  const [phoneError, setPhoneError]                     = useState<string | null>(null)
  const [addressLine1, setAddressLine1]                 = useState('')
  const [city, setCity]                                 = useState('')
  const [county, setCounty]                             = useState('')
  const [customerNotes, setCustomerNotes]               = useState('')
  const [addressSuggestions, setAddressSuggestions]     = useState<string[]>([])
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)

  const UK_PHONE_RE = /^(\+44|0044|0)(7\d{9}|[1-9]\d{8,9})$/
  function isValidUKPhone(val: string) {
    return UK_PHONE_RE.test(val.replace(/[\s\-().]/g, ''))
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingCart')
      if (raw) setCartItems(JSON.parse(raw))
    } catch {
      // ignore corrupt storage
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, address')
        .eq('id', session.user.id)
        .maybeSingle()
      if (data) {
        if (data.full_name) setCustomerName(data.full_name)
        if (data.phone)     setCustomerPhone(data.phone)
        if (data.address)   setAddressLine1(data.address)
      }
    })
  }, [])

  const subtotal = cartItems.reduce((s, i) => s + i.totalPrice, 0)
  const discount = promoApplied ? promoApplied.discount_amount : 0
  const deliveryFee = zone ? Number(zone.delivery_fee) : 0
  const total = subtotal - discount + deliveryFee

  async function handleFindAddress() {
    const pc = postcode.trim().replace(/\s/g, '').toUpperCase()
    if (!pc) { toast.error('Enter a postcode first'); return }
    setAddressLookupLoading(true)
    setAddressSuggestions([])
    try {
      // ─────────────────────────────────────────────────────────────────────────
      // PRODUCTION: Replace this postcodes.io call with the Royal Mail PAF API
      // (e.g. getAddress.io: GET https://api.getAddress.io/find/{postcode}?api-key=KEY)
      // Parse the real response to build the suggestions array below.
      // ─────────────────────────────────────────────────────────────────────────
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
      const data = await res.json()
      if (data.status !== 200) { toast.error('Invalid postcode — please check and try again'); return }
      const r = data.result
      const town   = r.parish || r.admin_ward || r.admin_district || ''
      const cty    = r.admin_county || ''
      const fmt    = postcode.trim().toUpperCase()
      // Mock door-level suggestions — replace with real PAF results in production
      const street = 'High Street'
      setAddressSuggestions([
        `1 ${street}, ${town}, ${cty}, ${fmt}`,
        `2 ${street}, ${town}, ${cty}, ${fmt}`,
        `Flat 3, ${street}, ${town}, ${cty}, ${fmt}`,
      ])
      validatePostcode(fmt)
    } catch {
      toast.error('Could not look up postcode — please try again')
    } finally {
      setAddressLookupLoading(false)
    }
  }

  function selectAddress(full: string) {
    const parts = full.split(', ')
    setAddressLine1(parts[0] ?? '')
    setCity(parts[1] ?? '')
    setCounty(parts[2] ?? '')
    setAddressSuggestions([])
  }

  function handlePostcodeChange(val: string) {
    const upper = val.toUpperCase()
    setPostcode(upper)
    setZone(null)
    setZoneError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = upper.trim()
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

  async function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase()
    if (!code) return
    setPromoLoading(true)
    setPromoError(null)
    setPromoApplied(null)
    try {
      const res = await fetch(`/api/promotions?code=${encodeURIComponent(code)}&subtotal=${subtotal.toFixed(2)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid promo code')
      setPromoApplied(data)
      toast.success(`Code ${data.code} applied — -£${data.discount_amount.toFixed(2)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error applying promo code'
      setPromoError(msg)
      toast.error(msg)
    } finally {
      setPromoLoading(false)
    }
  }

  async function handlePay() {
    if (!zone || cartItems.length === 0) return
    if (!customerName.trim())              { setSubmitError('Please enter your full name');                  return }
    if (!customerPhone.trim())             { setSubmitError('Please enter your phone number');               return }
    if (!isValidUKPhone(customerPhone))    { setSubmitError('Please enter a valid UK phone number');         return }
    if (!addressLine1.trim())              { setSubmitError('Please enter your delivery address');           return }
    const fullAddress = [addressLine1, city, county, postcode.trim().toUpperCase()].filter(Boolean).join(', ')
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:               cartItems,
          delivery_fee:        deliveryFee,
          postcode:            postcode.trim().toUpperCase(),
          promo_code:          promoApplied?.code ?? null,
          customer_name:       customerName.trim(),
          customer_phone:      customerPhone.trim(),
          delivery_address:    fullAddress,
          delivery_postcode:   postcode.trim().toUpperCase(),
          customer_notes:      customerNotes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      sessionStorage.removeItem('pendingCart')
      window.location.href = data.url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setSubmitError(msg)
      toast.error(msg)
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
          <div className="flex gap-2">
            <input
              type="text"
              value={postcode}
              onChange={(e) => handlePostcodeChange(e.target.value)}
              placeholder="e.g. RH2 8AB"
              maxLength={8}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red uppercase"
            />
            <button
              onClick={handleFindAddress}
              disabled={!postcode.trim() || addressLookupLoading}
              className="px-4 py-3 bg-brand-dark hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shrink-0"
            >
              {addressLookupLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {addressLookupLoading ? '' : 'Find Address'}
            </button>
          </div>

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

          {addressSuggestions.length > 0 && (
            <div className="border border-brand-red/30 rounded-xl overflow-hidden shadow-sm">
              <p className="text-xs font-semibold text-gray-500 px-3 pt-2.5 pb-1">Select your address:</p>
              {addressSuggestions.map((addr) => (
                <button
                  key={addr}
                  onClick={() => selectAddress(addr)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-brand-red hover:text-white transition-colors border-t border-gray-100 first:border-t-0 font-medium"
                >
                  {addr}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Your Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark flex items-center gap-2">
            <User size={16} className="text-brand-red" />
            Your Details
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); if (phoneError) setPhoneError(null) }}
                onBlur={() => {
                  if (customerPhone.trim() && !isValidUKPhone(customerPhone))
                    setPhoneError('Please enter a valid UK phone number')
                  else setPhoneError(null)
                }}
                placeholder="e.g. 07700 900000"
                className={`w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red ${phoneError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {phoneError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                  <AlertCircle size={12} />
                  {phoneError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Address Line 1 *</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. 12 High Street"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">City / Town</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Reigate"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">County</label>
                <input
                  type="text"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="e.g. Surrey"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Order Notes</label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any special instructions, allergen info, gate codes…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red resize-none"
              />
            </div>
          </div>
        </div>

        {/* Promo Code */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark flex items-center gap-2">
            <Tag size={16} className="text-brand-red" />
            Promo Code
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase())
                if (promoApplied) setPromoApplied(null)
                if (promoError) setPromoError(null)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo() }}
              placeholder="e.g. GRANDOPENING"
              maxLength={30}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red uppercase"
            />
            <button
              onClick={handleApplyPromo}
              disabled={!promoCode.trim() || promoLoading}
              className="px-5 py-3 bg-brand-dark hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
            </button>
          </div>

          {promoError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {promoError}
            </div>
          )}

          {promoApplied && (
            <div className="flex items-center justify-between text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
              <span className="font-semibold">✓ Code {promoApplied.code} applied</span>
              <span className="font-bold text-green-600">
                {promoApplied.discount_type === 'flat'
                  ? `-£${promoApplied.discount_amount.toFixed(2)}`
                  : `-£${promoApplied.discount_amount.toFixed(2)} (${promoApplied.discount_value}% off)`}
              </span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
          </div>
          {promoApplied && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount ({promoApplied.code})</span>
              <span>-£{discount.toFixed(2)}</span>
            </div>
          )}
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
