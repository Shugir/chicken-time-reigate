'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MapPin, AlertCircle, Loader2, ShoppingCart, Tag, User, Clock } from 'lucide-react'
import { generateScheduleSlots, type ScheduleSlot } from '@/lib/utils/schedule-utils'
import type { BusinessHours, DayKey } from '@/lib/store-status'
import { getUKNow } from '@/lib/store-status'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase-browser'
import RewardPicker from '@/components/RewardPicker'
import { isRewardRejection, rewardDiscountAmount, type CheckoutReward } from '@/lib/reward-checkout'
import { formatExtra, type SelectedExtra } from '@/lib/order-modifiers'

interface CartItem {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  totalPrice: number
  spicy_level?: string
  extras: SelectedExtra[]
  removals: string[]
  additions?: string[]
  notes?: string
}

interface DeliveryZone {
  id: string
  postcode_prefix: string
  delivery_fee: number
  min_order_amount: number
  free_delivery_threshold: number | null
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
  const [autoPromo, setAutoPromo]       = useState<{ code: string | null; discount_type: string; discount_value: number; discount_amount: number } | null>(null)
  const [dealsQuote, setDealsQuote]     = useState<{ applied: { deal_id: string; name: string; savings: number }[]; totalDiscount: number }>({ applied: [], totalDiscount: 0 })
  const [selectedReward, setSelectedReward] = useState<CheckoutReward | null>(null)

  const [customerName, setCustomerName]                 = useState('')
  const [customerEmail, setCustomerEmail]               = useState('')
  const [customerPhone, setCustomerPhone]               = useState('')
  const [phoneError, setPhoneError]                     = useState<string | null>(null)
  const [addressLine1, setAddressLine1]                 = useState('')
  const [addressLine1Error, setAddressLine1Error]       = useState<string | null>(null)
  const [city, setCity]                                 = useState('')
  const [county, setCounty]                             = useState('')
  const [customerNotes, setCustomerNotes]               = useState('')
  const [addressLookupLoading, setAddressLookupLoading] = useState(false)
  const [addressAutoFilled, setAddressAutoFilled]       = useState(false)
  const [confirmDetails, setConfirmDetails]             = useState(false)
  const [confirmDetailsError, setConfirmDetailsError]   = useState(false)
  const [fulfillmentMode, setFulfillmentMode]           = useState<'delivery' | 'pickup'>('delivery')
  const [scheduleMode, setScheduleMode]                 = useState<'asap' | 'scheduled'>('asap')
  const [scheduledFor, setScheduledFor]                 = useState<string>('')
  const [scheduleSlots, setScheduleSlots]               = useState<ScheduleSlot[]>([])
  const [businessHours, setBusinessHours]               = useState<BusinessHours | null>(null)
  const [storeClosedBanner, setStoreClosedBanner]       = useState<string | null>(null)

  const UK_PHONE_RE = /^(\+44|0044|0)(7\d{9}|[1-9]\d{8,9})$/
  function isValidUKPhone(val: string) {
    return UK_PHONE_RE.test(val.replace(/[\s\-().]/g, ''))
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingCart')
      if (raw) setCartItems(JSON.parse(raw))
      const mode = sessionStorage.getItem('fulfillment_mode')
      if (mode === 'pickup') setFulfillmentMode('pickup')
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
      if (session.user.email) setCustomerEmail(session.user.email)
    })
  }, [])

  useEffect(() => {
    fetch('/api/store-settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.business_hours) setBusinessHours(d.business_hours as BusinessHours)
        if (!d.isCurrentlyOpen) {
          const msg = d.closedReason || 'Store is currently closed'
          setStoreClosedBanner(d.closedUntil ? `${msg}. ${d.closedUntil}.` : msg)
        } else {
          setStoreClosedBanner(null)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (scheduleMode === 'scheduled') {
      const { weekday: todayKey } = getUKNow()
      const todayHours = businessHours?.[todayKey]
      if (businessHours && todayHours && !todayHours.enabled) {
        setScheduleSlots([])
        setScheduledFor('')
        return
      }
      const slots = generateScheduleSlots(
        new Date(),
        todayHours?.open ?? '11:00',
        todayHours?.close ?? '22:00',
      )
      setScheduleSlots(slots)
      // Only reset selection if empty (prevents race-condition overwrite when businessHours resolves)
      if (slots.length > 0) setScheduledFor((prev) => prev || slots[0].value)
      else setScheduledFor('')
    } else {
      setScheduledFor('')
    }
  }, [scheduleMode, businessHours])

  const subtotal = cartItems.reduce((s, i) => s + i.totalPrice, 0)

  useEffect(() => {
    if (subtotal <= 0) return
    fetch('/api/auto-apply')
      .then((r) => r.json())
      .then((data) => {
        if (data.promo) {
          const p = data.promo
          let discount_amount: number
          if (p.discount_type === 'percentage') {
            discount_amount = Math.round(subtotal * (p.discount_value / 100) * 100) / 100
          } else {
            discount_amount = Math.min(p.discount_value, subtotal)
          }
          if (subtotal >= (p.min_order_amount ?? 0)) {
            setAutoPromo({ ...p, discount_amount })
          }
        }
      })
      .catch(() => {})
  }, [subtotal])

  useEffect(() => {
    if (cartItems.length === 0) return
    fetch('/api/deals/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItems.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })) }),
    })
      .then((r) => r.json())
      .then((data) => setDealsQuote(data))
      .catch(() => {})
  }, [cartItems])

  const isPickup = fulfillmentMode === 'pickup'
  const dealsDiscount = dealsQuote.totalDiscount
  // Mirrors the checkout API: a reward is refused outright once the deals engine
  // has priced this cart, and /api/deals/quote runs the same matchDeals pass.
  const dealsBlocked = dealsDiscount > 0
  const activeReward = dealsBlocked ? null : selectedReward
  const rewardDiscount = rewardDiscountAmount(activeReward, subtotal)
  const discount = promoApplied ? promoApplied.discount_amount : 0
  const baseDeliveryFee = zone ? Number(zone.delivery_fee) : 0
  const freeDeliveryApplied = !isPickup && (
    activeReward?.discount_type === 'free_delivery' || !!(
      zone?.free_delivery_threshold &&
      Number(zone.free_delivery_threshold) > 0 &&
      subtotal >= Number(zone.free_delivery_threshold)
    )
  )
  const deliveryFee = isPickup ? 0 : (freeDeliveryApplied ? 0 : baseDeliveryFee)
  const autoDiscount = autoPromo ? autoPromo.discount_amount : 0
  const total = subtotal - discount - autoDiscount - dealsDiscount - rewardDiscount + deliveryFee

  // One direction only: picking a reward wins and clears the promo code, and the
  // promo input stays disabled while it is applied. Both can never be set at once,
  // which is what the checkout API rejects with a 400.
  function handleSelectReward(reward: CheckoutReward | null) {
    setSelectedReward(reward)
    if (reward) {
      setPromoCode('')
      setPromoApplied(null)
      setPromoError(null)
    }
  }

  async function handleFindAddress() {
    const pc = postcode.trim().replace(/\s/g, '').toUpperCase()
    if (!pc) { toast.error('Enter a postcode first'); return }
    setAddressLookupLoading(true)
    setAddressAutoFilled(false)
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
      const data = await res.json()
      if (data.status !== 200) { toast.error('Invalid postcode — please check and try again'); return }
      const r = data.result
      const town = r.parish || r.admin_ward || r.admin_district || ''
      const cty  = r.admin_county || ''
      setCity(town)
      setCounty(cty)
      setAddressAutoFilled(true)
      validatePostcode(postcode.trim().toUpperCase())
    } catch {
      toast.error('Could not look up postcode — please try again')
    } finally {
      setAddressLookupLoading(false)
    }
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
    if (storeClosedBanner) { setSubmitError('Store is currently closed — orders are not being accepted'); return }
    if (!isPickup && !zone || cartItems.length === 0) return
    if (!customerName.trim())              { setSubmitError('Please enter your full name');                  return }
    if (!customerPhone.trim())             { setSubmitError('Please enter your phone number');               return }
    if (!isValidUKPhone(customerPhone))    { setSubmitError('Please enter a valid UK phone number');         return }
    if (!isPickup && !addressLine1.trim()) { setSubmitError('Please enter your delivery address');           return }
    if (scheduleMode === 'scheduled' && !scheduledFor) { setSubmitError('Please select a time for your scheduled order'); return }
    if (!confirmDetails)                   { setConfirmDetailsError(true); setSubmitError('Please confirm your details before placing your order'); return }
    const fullAddress = isPickup ? null : [addressLine1, city, county, postcode.trim().toUpperCase()].filter(Boolean).join(', ')
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:               cartItems,
          delivery_fee:        deliveryFee,
          postcode:            isPickup ? undefined : postcode.trim().toUpperCase(),
          promo_code:          promoApplied?.code ?? null,
          auto_promo_code:     autoPromo?.code ?? null,
          reward_promotion_id: activeReward?.id ?? null,
          customer_name:       customerName.trim(),
          customer_phone:      customerPhone.trim(),
          customer_email:      customerEmail.trim() || null,
          delivery_address:    fullAddress,
          delivery_postcode:   isPickup ? null : postcode.trim().toUpperCase(),
          customer_notes:      customerNotes.trim() || null,
          order_type:          fulfillmentMode,
          scheduled_for:       scheduleMode === 'scheduled' ? scheduledFor : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      sessionStorage.removeItem('pendingCart')
      window.location.href = data.url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      // A reward can go stale between page load and submit (expired, tier changed,
      // already spent). Drop it so the retry isn't guaranteed to fail the same way.
      if (activeReward && isRewardRejection(msg)) setSelectedReward(null)
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

        {/* Store closed banner */}
        {storeClosedBanner && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-bold text-sm">We&apos;re not accepting orders right now</p>
              <p className="text-sm mt-0.5">{storeClosedBanner}</p>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark">Order Summary</h2>
          <div className="divide-y divide-gray-100">
            {cartItems.map((item, i) => (
              <div key={i} className="flex justify-between py-2.5 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">{item.quantity}× {item.name}</span>
                  {item.spicy_level && (
                    <p className="text-xs text-gray-400">Spicy: {item.spicy_level}</p>
                  )}
                  {item.removals.length > 0 && (
                    <p className="text-xs text-brand-red">{item.removals.join(', ')}</p>
                  )}
                  {(item.additions?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-400">{item.additions!.map((a) => `+ ${a}`).join(', ')}</p>
                  )}
                  {item.extras.length > 0 && (
                    <p className="text-xs text-gray-400">{item.extras.map((e) => `+ ${formatExtra(e)}`).join(', ')}</p>
                  )}
                </div>
                <span className="font-semibold text-gray-900 shrink-0 ml-4">£{item.totalPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* When would you like this? */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-heading font-bold text-base text-brand-dark flex items-center gap-2">
            <Clock size={16} className="text-brand-red" />
            When would you like this?
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('asap')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-colors ${
                scheduleMode === 'asap'
                  ? 'bg-brand-red border-brand-red text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              🚀 ASAP
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('scheduled')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-colors ${
                scheduleMode === 'scheduled'
                  ? 'bg-brand-red border-brand-red text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              🕒 Schedule for Later
            </button>
          </div>

          {scheduleMode === 'scheduled' && (
            scheduleSlots.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                {(() => {
                  const { weekday: todayKey } = getUKNow()
                  const todayHours = businessHours?.[todayKey]
                  if (businessHours && todayHours && !todayHours.enabled) return 'Scheduling not available — store is closed today.'
                  return `No available time slots right now. Orders close at ${businessHours?.[todayKey]?.close ?? '22:00'}.`
                })()}
              </div>
            ) : (
              <select
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red bg-white"
              >
                {scheduleSlots.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            )
          )}
        </div>

        {/* Delivery address / Pickup banner */}
        {isPickup ? (
          <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🛍️</div>
              <div>
                <p className="font-heading font-bold text-base text-amber-900">Collection Order</p>
                <p className="text-sm text-amber-700 mt-0.5">No delivery fee · Collect in store when your order is ready</p>
              </div>
            </div>
          </div>
        ) : (
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
                <span className="font-bold flex items-center gap-1.5">
                  {freeDeliveryApplied ? (
                    <>
                      <span className="line-through text-gray-400 font-normal">£{baseDeliveryFee.toFixed(2)}</span>
                      <span className="text-green-700">Free delivery</span>
                    </>
                  ) : deliveryFee === 0 ? 'Free delivery' : `£${deliveryFee.toFixed(2)} delivery`}
                </span>
              </div>
            )}
          </div>
        )}

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
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Email Address <span className="text-gray-400 font-normal">(for order tracking)</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
              />
            </div>
            {!isPickup && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => { setAddressLine1(e.target.value); if (addressLine1Error) setAddressLine1Error(null) }}
                    onBlur={() => {
                      if (!addressLine1.trim()) setAddressLine1Error('Address is required')
                      else setAddressLine1Error(null)
                    }}
                    placeholder="e.g. 12 High Street"
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red ${addressLine1Error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  />
                  {addressLine1Error && (
                    <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                      <AlertCircle size={12} />
                      {addressLine1Error}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      City / Town
                      {addressAutoFilled && city && <span className="ml-1.5 text-emerald-600 font-semibold">✓ auto-filled</span>}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Reigate"
                      className={`w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red ${addressAutoFilled && city ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      County
                      {addressAutoFilled && county && <span className="ml-1.5 text-emerald-600 font-semibold">✓ auto-filled</span>}
                    </label>
                    <input
                      type="text"
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      placeholder="e.g. Surrey"
                      className={`w-full border rounded-xl px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red ${addressAutoFilled && county ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'}`}
                    />
                  </div>
                </div>
              </>
            )}
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
              disabled={!!activeReward}
              placeholder="e.g. GRANDOPENING"
              maxLength={30}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red uppercase disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleApplyPromo}
              disabled={!promoCode.trim() || promoLoading || !!activeReward}
              className="px-5 py-3 bg-brand-dark hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
            </button>
          </div>

          {activeReward && (
            <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-gray-400" />
              Remove your reward to use a promo code instead.
            </div>
          )}

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

        {/* Rewards */}
        <RewardPicker
          subtotal={subtotal}
          dealsBlocked={dealsBlocked}
          selectedRewardId={activeReward?.id ?? null}
          onSelect={handleSelectReward}
        />

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
          {autoPromo && (
            <div className="flex justify-between text-sm text-sky-600">
              <span>⚡ Flash Deal {autoPromo.code ? `(${autoPromo.code})` : ''}</span>
              <span>-£{autoPromo.discount_amount.toFixed(2)}</span>
            </div>
          )}
          {activeReward && (
            <div className="flex justify-between text-sm text-amber-600">
              <span>🎁 {activeReward.title} ({activeReward.points_cost.toLocaleString()} pts)</span>
              <span>
                {rewardDiscount > 0
                  ? `-£${rewardDiscount.toFixed(2)}`
                  : activeReward.benefit}
              </span>
            </div>
          )}
          {dealsQuote.applied.map((d, i) => (
            <div key={`${d.deal_id}-${i}`} className="flex justify-between text-sm text-emerald-600">
              <span>🎉 {d.name}</span>
              <span>-£{d.savings.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm text-gray-600">
            <span>{isPickup ? 'Collection' : 'Delivery'}</span>
            <span className="flex items-center gap-1.5">
              {isPickup ? (
                <span className="font-bold text-green-600">FREE</span>
              ) : zone ? (
                freeDeliveryApplied ? (
                  <>
                    <span className="line-through text-gray-400">£{baseDeliveryFee.toFixed(2)}</span>
                    <span className="font-bold text-green-600">FREE</span>
                  </>
                ) : deliveryFee === 0 ? 'Free' : `£${deliveryFee.toFixed(2)}`
              ) : '—'}
            </span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{(isPickup || zone) ? `£${total.toFixed(2)}` : '—'}</span>
          </div>
        </div>

        {/* Liability confirmation */}
        <label
          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
            confirmDetailsError
              ? 'border-red-400 bg-red-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="relative shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={confirmDetails}
              onChange={(e) => {
                setConfirmDetails(e.target.checked)
                if (e.target.checked) setConfirmDetailsError(false)
              }}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              confirmDetails
                ? 'bg-brand-red border-brand-red'
                : confirmDetailsError
                  ? 'border-red-400 bg-white'
                  : 'border-gray-300 bg-white'
            }`}>
              {confirmDetails && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <p className={`text-sm font-medium leading-snug ${confirmDetailsError ? 'text-red-700' : 'text-gray-800'}`}>
              {isPickup
                ? 'I confirm my name and phone number are correct so we can notify you when your order is ready.'
                : 'I confirm my delivery address and phone number are 100% correct. I understand the restaurant is not liable for delayed or failed deliveries due to incorrect details.'
              }
            </p>
            {confirmDetailsError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                <AlertCircle size={12} />
                Please confirm before placing your order
              </p>
            )}
          </div>
        </label>

        {/* Pay button */}
        {submitError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {submitError}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={(!isPickup && !zone) || submitting || cartItems.length === 0 || !!storeClosedBanner}
          className="w-full bg-brand-red hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/20"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
            : <><span>Pay £{total.toFixed(2)}</span><ChevronRight size={16} /></>
          }
        </button>
      </div>
    </div>
  )
}
