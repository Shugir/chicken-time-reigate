'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'
import {
  ShoppingBag, Clock, User as UserIcon, Shield, LogOut,
  CheckCircle2, Truck, Package, RefreshCw,
  Loader2, Save, Trash2, AlertTriangle, ChevronRight,
  Tag, Printer, Copy, Check, Star,
} from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/format-date'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ThemeToggle'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  item_name: string
  quantity: number
  unit_price: number
  extras:   { name: string; price: number }[] | null
  removals: string[] | null
  notes:    string | null
}

interface Order {
  id:                string
  status:            string
  delivery_status:   string | null
  total_amount:      number
  created_at:        string
  customer_name:     string | null
  customer_phone:    string | null
  delivery_address:  string | null
  delivery_postcode: string | null
  customer_notes:    string | null
  promo_code_used:   string | null
  discount_applied:  number
  applied_deals:     { deal_id: string; name: string; type: string; savings: number }[] | null
  order_items:       OrderItem[]
}

interface PromoCode {
  code:             string
  discount_type:    'percentage' | 'flat'
  discount_value:   number
  min_order_amount: number
}

interface Profile {
  full_name: string | null
  phone:     string | null
  address:   string | null
}

type Tab = 'active' | 'history' | 'profile' | 'security' | 'offers' | 'rewards'

// ─── Order tracking helpers ───────────────────────────────────────────────────

const TIMELINE = [
  { label: 'Placed',   icon: Package },
  { label: 'Kitchen',  icon: Clock },
  { label: 'On Way',   icon: Truck },
  { label: 'Done',     icon: CheckCircle2 },
]

function trackingStep(order: Order): number {
  if (order.delivery_status === 'delivered' || order.status === 'delivered') return 3
  if (order.delivery_status === 'out_for_delivery' || order.status === 'dispatched') return 2
  if (order.status === 'ready' || order.status === 'preparing') return 1
  return 0
}

function statusLabel(order: Order): string {
  if (order.delivery_status === 'failed') return 'Failed'
  if (order.delivery_status === 'delivered' || order.status === 'delivered') return 'Delivered'
  if (order.delivery_status === 'out_for_delivery') return 'On the Way'
  if (order.status === 'dispatched') return 'On the Way'
  if (order.status === 'ready') return 'Ready'
  if (order.status === 'preparing') return 'Preparing'
  return 'Pending'
}

function statusColor(order: Order): string {
  if (order.delivery_status === 'failed') return 'bg-red-500/15 text-red-600 dark:text-red-400'
  if (order.delivery_status === 'delivered' || order.status === 'delivered') return 'bg-green-500/15 text-green-600 dark:text-green-400'
  return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
}


function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg ${className ?? ''}`} />
  )
}

// ─── OfferCard component ──────────────────────────────────────────────────────

function OfferCard({ promo }: { promo: PromoCode }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(promo.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const discountLabel = promo.discount_type === 'percentage'
    ? `${promo.discount_value}% off`
    : `£${Number(promo.discount_value).toFixed(2)} off`

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-sm font-bold text-brand-dark dark:text-white tracking-widest">
            {promo.code}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
            {discountLabel}
          </span>
        </div>
        {Number(promo.min_order_amount) > 0 && (
          <p className="text-xs text-zinc-500">
            Min. order £{Number(promo.min_order_amount).toFixed(2)}
          </p>
        )}
      </div>
      <button
        onClick={copyCode}
        className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300 active:scale-[0.98]"
      >
        {copied ? <Check size={12} className="text-green-600 dark:text-green-400" /> : <Copy size={12} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

const ORDER_SELECT = `
  id, status, delivery_status, total_amount, created_at,
  customer_name, customer_phone, delivery_address, delivery_postcode, customer_notes,
  promo_code_used, discount_applied, applied_deals,
  order_items(id, item_name, quantity, unit_price, extras, removals, notes)
`

// ─── OrderCard component ──────────────────────────────────────────────────────

function OrderCard({ order, onReorder, onPrintReceipt }: {
  order: Order
  onReorder?: (o: Order) => void
  onPrintReceipt?: (o: Order) => void
}) {
  const failed = order.delivery_status === 'failed'
  const step   = trackingStep(order)

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-zinc-500 mb-0.5">
            #{order.id.slice(-6).toUpperCase()}
          </p>
          <p className="text-xs text-zinc-600">{formatDateTime(order.created_at)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(order)}`}>
          {statusLabel(order)}
        </span>
      </div>

      {/* Tracking timeline */}
      {!failed && (
        <div className="flex items-start mb-5">
          {TIMELINE.map((s, i) => {
            const done   = step >= i
            const active = step === i && step < 3
            const Icon   = s.icon
            return (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    done ? 'bg-brand-red' : 'bg-zinc-800'
                  } ${active ? 'ring-2 ring-brand-red/40' : ''}`}>
                    <Icon size={13} className={done ? 'text-white' : 'text-zinc-600'} />
                  </div>
                  <span className={`text-[9px] leading-tight ${done ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-600'}`}>
                    {s.label}
                  </span>
                </div>
                {i < TIMELINE.length - 1 && (
                  <div className={`h-px flex-1 mb-4 mx-0.5 ${step > i ? 'bg-brand-red' : 'bg-zinc-800'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5 mb-4">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              {item.quantity}× {item.item_name}
              {item.extras && item.extras.length > 0 && (
                <span className="text-xs text-zinc-500 ml-1">
                  +{item.extras.map(e => e.name).join(', ')}
                </span>
              )}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400 shrink-0 ml-2">
              £{(item.unit_price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Total + Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div>
          <span className="text-sm font-bold text-brand-dark dark:text-white">
            £{Number(order.total_amount).toFixed(2)}
          </span>
          {order.promo_code_used && Number(order.discount_applied) > 0 && (
            <span className="ml-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
              -{order.promo_code_used} (−£{Number(order.discount_applied).toFixed(2)})
            </span>
          )}
          {(order.applied_deals ?? []).map((d) => (
            <span key={d.deal_id} className="ml-2 text-[10px] text-green-600 dark:text-green-400 font-medium">
              🎉 {d.name} (−£{d.savings.toFixed(2)})
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {onPrintReceipt && (
            <button
              onClick={() => onPrintReceipt(order)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-brand-dark dark:hover:text-zinc-300 transition active:scale-[0.98]"
            >
              <Printer size={12} />
              Receipt
            </button>
          )}
          {onReorder && (
            <button
              onClick={() => onReorder(order)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-red hover:text-brand-red/80 dark:text-red-400 dark:hover:text-red-400/80 transition active:scale-[0.98]"
            >
              <RefreshCw size={12} />
              Reorder
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter()

  const [user, setUser]     = useState<User | null>(null)
  const [tab, setTab]       = useState<Tab>('active')
  const [loading, setLoading] = useState(true)

  // Active orders
  const [activeOrders, setActiveOrders]   = useState<Order[]>([])
  const [activeLoading, setActiveLoading] = useState(false)

  // History
  const [historyOrders, setHistoryOrders]   = useState<Order[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded]   = useState(false)

  // Profile
  const [profile, setProfile]             = useState<Profile>({ full_name: null, phone: null, address: null })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLoaded, setProfileLoaded]   = useState(false)
  const [profileSaving, setProfileSaving]   = useState(false)
  const [profileSaved, setProfileSaved]     = useState(false)
  const [profileError, setProfileError]     = useState<string | null>(null)

  // Offers
  const [offers, setOffers]           = useState<PromoCode[]>([])
  const [offersLoaded, setOffersLoaded] = useState(false)

  // Security
  const [resetSent, setResetSent]       = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [closeError, setCloseError]     = useState<string | null>(null)

  // ── Data fetchers ─────────────────────────────────────────────────────────

  async function fetchActiveOrders() {
    setActiveLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .not('status', 'eq', 'delivered')
      .or('delivery_status.is.null,delivery_status.not.in.(delivered,failed)')
      .order('created_at', { ascending: false })
    setActiveOrders((data ?? []) as Order[])
    setActiveLoading(false)
  }

  async function fetchHistory() {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .or('status.eq.delivered,delivery_status.eq.delivered,delivery_status.eq.failed')
      .order('created_at', { ascending: false })
    setHistoryOrders((data ?? []) as Order[])
    setHistoryLoading(false)
    setHistoryLoaded(true)
  }

  async function fetchOffers() {
    const res = await fetch('/api/promo-codes')
    if (res.ok) {
      const data = await res.json()
      setOffers(data)
    }
    setOffersLoaded(true)
  }

  async function fetchProfile() {
    setProfileLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, address')
      .maybeSingle()
    if (data) setProfile(data as Profile)
    setProfileLoading(false)
    setProfileLoaded(true)
  }

  // ── Auth check on mount ───────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/sign-in'); return }
      setUser(u)
      setLoading(false)
      fetchActiveOrders()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lazy-load tabs ────────────────────────────────────────────────────────

  useEffect(() => {
    if (loading) return
    if (tab === 'history' && !historyLoaded) fetchHistory()
    if (tab === 'profile' && !profileLoaded) fetchProfile()
    if (tab === 'offers'  && !offersLoaded)  fetchOffers()
  }, [tab, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleReorder(order: Order) {
    const cart = order.order_items.map(item => ({
      name:       item.item_name,
      price:      item.unit_price,
      quantity:   item.quantity,
      totalPrice: item.unit_price * item.quantity,
      extras:     item.extras   ?? [],
      removals:   item.removals ?? [],
      notes:      item.notes    ?? undefined,
    }))
    sessionStorage.setItem('pendingCart', JSON.stringify(cart))
    router.push('/checkout')
  }

  function handlePrintReceipt(order: Order) {
    const win = window.open('', '_blank')
    if (!win) return
    const subtotal = order.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    const discount = Number(order.discount_applied) || 0
    const delivery = Number(order.total_amount) - subtotal + discount
    const rows = order.order_items.map(i => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee">${i.quantity}× ${i.item_name}${i.extras?.length ? ` <small style="color:#888">+${i.extras.map(e => e.name).join(', ')}</small>` : ''}</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">£${(i.unit_price * i.quantity).toFixed(2)}</td>
      </tr>`).join('')
    const dealRows = (order.applied_deals ?? [])
      .map((d) => `<tr><td style="padding:4px 0;color:#16a34a">🎉 ${d.name}</td><td style="text-align:right;color:#16a34a">−£${d.savings.toFixed(2)}</td></tr>`)
      .join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #${order.id.slice(-6).toUpperCase()}</title>
      <style>body{font-family:Georgia,serif;max-width:480px;margin:40px auto;color:#1a1a1a;line-height:1.5}
      h1{font-size:22px;margin:0 0 2px}p{margin:2px 0}table{width:100%;border-collapse:collapse;margin:16px 0}
      .total{font-weight:bold;font-size:16px}.mono{font-family:monospace;letter-spacing:1px}
      .footer{margin-top:32px;font-size:11px;color:#999;text-align:center}hr{border:none;border-top:1px solid #ddd;margin:16px 0}
      @media print{.no-print{display:none}}</style></head><body>
      <div class="no-print" style="margin-bottom:20px"><button onclick="window.print()" style="padding:8px 20px;cursor:pointer">Print</button></div>
      <h1>Chicken Time Reigate</h1>
      <p style="color:#888;font-size:13px">85 High Street, Reigate RH2 9AE</p>
      <hr>
      <p><strong>Receipt</strong></p>
      <p class="mono" style="font-size:13px">#${order.id.slice(-6).toUpperCase()}</p>
      <p style="font-size:13px;color:#555">${new Date(order.created_at).toLocaleString('en-GB')}</p>
      ${order.customer_name ? `<p style="font-size:13px">Customer: ${order.customer_name}</p>` : ''}
      ${order.delivery_address ? `<p style="font-size:13px">Delivery: ${order.delivery_address}</p>` : ''}
      <hr>
      <table><tbody>${rows}</tbody></table>
      <table style="margin-top:0"><tbody>
        <tr><td style="padding:4px 0;color:#555">Subtotal</td><td style="text-align:right">£${subtotal.toFixed(2)}</td></tr>
        ${discount > 0 ? `<tr><td style="padding:4px 0;color:#16a34a">Discount (${order.promo_code_used})</td><td style="text-align:right;color:#16a34a">−£${discount.toFixed(2)}</td></tr>` : ''}
        ${dealRows}
        ${delivery > 0 ? `<tr><td style="padding:4px 0;color:#555">Delivery</td><td style="text-align:right">£${delivery.toFixed(2)}</td></tr>` : ''}
        <tr class="total"><td style="padding:8px 0;border-top:2px solid #1a1a1a">Total</td><td style="text-align:right;border-top:2px solid #1a1a1a">£${Number(order.total_amount).toFixed(2)}</td></tr>
      </tbody></table>
      <div class="footer"><p>Thank you for ordering with Chicken Time Reigate!</p><p>chickentimereigate.co.uk</p></div>
    </body></html>`)
    win.document.close()
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    setProfileError(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user!.id, ...profile })
    if (error) {
      setProfileError(error.message)
      toast.error(error.message)
    } else {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
      toast.success('Profile saved!')
    }
    setProfileSaving(false)
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/account`,
    })
    setResetSent(true)
    toast.success('Reset email sent — check your inbox.')
    setResetLoading(false)
  }

  async function handleCloseAccount() {
    setCloseLoading(true)
    setCloseError(null)
    const res = await fetch('/api/account/close', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCloseError(body.error ?? 'Failed to close account')
      toast.error(body.error ?? 'Failed to close account')
      setCloseLoading(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 py-6 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    )
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'active',   label: 'Active',   icon: Clock },
    { id: 'history',  label: 'History',  icon: ShoppingBag },
    { id: 'offers',   label: 'Offers',   icon: Tag },
    { id: 'rewards',  label: 'Rewards',  icon: Star },
    { id: 'profile',  label: 'Profile',  icon: UserIcon },
    { id: 'security', label: 'Account',  icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl leading-none">🍗</Link>
            <div>
              <p className="text-sm font-semibold leading-none text-brand-dark dark:text-white">My Account</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-brand-dark dark:hover:text-white transition-colors active:scale-[0.98]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950">
        <div className="max-w-lg mx-auto px-1 flex">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-1.5 py-3.5 text-[10px] font-medium border-b-2 transition-colors flex-1 justify-center ${
                  tab === t.id
                    ? 'border-brand-red text-brand-dark dark:text-white'
                    : 'border-transparent text-zinc-500 hover:text-brand-dark dark:hover:text-zinc-300'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── Active Orders ─────────────────────────────────────────────────── */}
        {tab === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Active Orders
              </h2>
              <button
                onClick={fetchActiveOrders}
                disabled={activeLoading}
                className="text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-400 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={activeLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {activeLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <Skeleton className="h-40 w-full rounded-3xl" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-14">
                <Package size={36} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-500 mb-4">No active orders</p>
                <Link
                  href="/order"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-red hover:text-brand-red/80 dark:text-red-400 dark:hover:text-red-400/80 active:scale-[0.98] transition-transform"
                >
                  Order now <ChevronRight size={14} />
                </Link>
              </div>
            ) : (
              activeOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </div>
        )}

        {/* ── Order History ─────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Order History
            </h2>

            {historyLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <Skeleton className="h-40 w-full rounded-3xl" />
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="text-center py-14">
                <ShoppingBag size={36} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No past orders yet</p>
              </div>
            ) : (
              historyOrders.map(order => (
                <OrderCard key={order.id} order={order} onReorder={handleReorder} onPrintReceipt={handlePrintReceipt} />
              ))
            )}
          </div>
        )}

        {/* ── Profile ───────────────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="space-y-5">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Profile
            </h2>

            {profileLoading ? (
              <Skeleton className="h-64 w-full rounded-3xl" />
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={profile.full_name ?? ''}
                    onChange={e => setProfile(p => ({ ...p, full_name: e.target.value || null }))}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-brand-dark dark:text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                    placeholder="Jane Smith"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone ?? ''}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value || null }))}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-brand-dark dark:text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                    placeholder="07700 900000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Default delivery address
                  </label>
                  <textarea
                    value={profile.address ?? ''}
                    onChange={e => setProfile(p => ({ ...p, address: e.target.value || null }))}
                    rows={2}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-brand-dark dark:text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red resize-none"
                    placeholder="123 High Street, Reigate"
                  />
                </div>

                {profileError && (
                  <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-300">{profileError}</p>
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="w-full bg-brand-red hover:bg-brand-red/90 disabled:opacity-60 text-white font-semibold
                             rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {profileSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  ) : profileSaved ? (
                    <><CheckCircle2 className="w-4 h-4" />Saved!</>
                  ) : (
                    <><Save className="w-4 h-4" />Save Changes</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Offers ────────────────────────────────────────────────────────── */}
        {tab === 'offers' && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Your Offers
            </h2>

            {!offersLoaded ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-3xl" />
                <Skeleton className="h-20 w-full rounded-3xl" />
              </div>
            ) : offers.length === 0 ? (
              <div className="text-center py-14">
                <Tag size={36} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No active offers right now</p>
              </div>
            ) : (
              offers.map(promo => (
                <OfferCard key={promo.code} promo={promo} />
              ))
            )}
          </div>
        )}

        {/* ── Rewards ───────────────────────────────────────────────────────── */}
        {tab === 'rewards' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Star size={36} className="text-amber-600 dark:text-amber-400" />
            <p className="text-brand-dark dark:text-white font-semibold">My Rewards</p>
            <p className="text-sm text-zinc-500 text-center">View your points balance, unlock rewards, and track your history.</p>
            <a
              href="/account/rewards"
              className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors"
            >
              Open Rewards →
            </a>
          </div>
        )}

        {/* ── Security ──────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Security
            </h2>

            {/* Password reset */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none p-5">
              <h3 className="text-sm font-semibold text-brand-dark dark:text-white mb-1">Password</h3>
              <p className="text-xs text-zinc-500 mb-4">
                We'll email a reset link to your inbox.
              </p>
              {resetSent ? (
                <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3.5 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-300">Reset email sent — check your inbox.</p>
                </div>
              ) : (
                <button
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-60 text-brand-dark dark:text-white font-medium
                             rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Password Reset Email
                </button>
              )}
            </div>

            {/* Close account */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-3xl p-5 shadow-sm dark:shadow-none">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Close Account</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Permanently deletes your account and anonymises your order history.
                This cannot be undone.
              </p>

              {closeError && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-300">{closeError}</p>
                </div>
              )}

              {!closeConfirm ? (
                <button
                  onClick={() => setCloseConfirm(true)}
                  className="w-full bg-red-600/15 hover:bg-red-600/25 border border-red-600/40 text-red-600 dark:text-red-400 font-medium
                             rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Trash2 size={13} />
                  Close My Account
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-2">Are you absolutely sure?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloseConfirm(false)}
                      className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-brand-dark dark:text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCloseAccount}
                      disabled={closeLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold
                                 rounded-lg py-2.5 text-sm transition flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {closeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Yes, Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
