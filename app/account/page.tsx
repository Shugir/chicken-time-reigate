'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import {
  ShoppingBag, Clock, User as UserIcon, Shield, LogOut,
  CheckCircle2, Truck, Package, RefreshCw,
  Loader2, Save, Trash2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/format-date'

// ─── Supabase (module-level so it's not re-created on every render) ───────────

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
  order_items:       OrderItem[]
}

interface Profile {
  full_name: string | null
  phone:     string | null
  address:   string | null
}

type Tab = 'active' | 'history' | 'profile' | 'security'

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
  if (order.delivery_status === 'failed') return 'bg-red-500/15 text-red-400'
  if (order.delivery_status === 'delivered' || order.status === 'delivered') return 'bg-green-500/15 text-green-400'
  return 'bg-amber-500/15 text-amber-400'
}


const ORDER_SELECT = `
  id, status, delivery_status, total_amount, created_at,
  customer_name, customer_phone, delivery_address, delivery_postcode, customer_notes,
  order_items(id, item_name, quantity, unit_price, extras, removals, notes)
`

// ─── OrderCard component ──────────────────────────────────────────────────────

function OrderCard({ order, onReorder }: { order: Order; onReorder?: (o: Order) => void }) {
  const failed = order.delivery_status === 'failed'
  const step   = trackingStep(order)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
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
                  <span className={`text-[9px] leading-tight ${done ? 'text-zinc-300' : 'text-zinc-600'}`}>
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
            <span className="text-zinc-300">
              {item.quantity}× {item.item_name}
              {item.extras && item.extras.length > 0 && (
                <span className="text-xs text-zinc-500 ml-1">
                  +{item.extras.map(e => e.name).join(', ')}
                </span>
              )}
            </span>
            <span className="text-zinc-400 shrink-0 ml-2">
              £{(item.unit_price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Total + Reorder */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
        <span className="text-sm font-bold text-white">
          £{Number(order.total_amount).toFixed(2)}
        </span>
        {onReorder && (
          <button
            onClick={() => onReorder(order)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-red hover:text-brand-red/80 transition-colors"
          >
            <RefreshCw size={12} />
            Reorder
          </button>
        )}
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
      if (!u) { router.push('/login'); return }
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

  async function handleSaveProfile() {
    setProfileSaving(true)
    setProfileError(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user!.id, ...profile })
    if (error) {
      setProfileError(error.message)
    } else {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
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
    setResetLoading(false)
  }

  async function handleCloseAccount() {
    setCloseLoading(true)
    setCloseError(null)
    const res = await fetch('/api/account/close', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setCloseError(body.error ?? 'Failed to close account')
      setCloseLoading(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'active',   label: 'Active',   icon: Clock },
    { id: 'history',  label: 'History',  icon: ShoppingBag },
    { id: 'profile',  label: 'Profile',  icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl leading-none">🍗</Link>
            <div>
              <p className="text-sm font-semibold leading-none">My Account</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-lg mx-auto px-1 flex">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-3.5 text-xs font-medium border-b-2 transition-colors flex-1 justify-center ${
                  tab === t.id
                    ? 'border-brand-red text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
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
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Active Orders
              </h2>
              <button
                onClick={fetchActiveOrders}
                disabled={activeLoading}
                className="text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} className={activeLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {activeLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="text-center py-14">
                <Package size={36} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-500 mb-4">No active orders</p>
                <Link
                  href="/order"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-red hover:text-brand-red/80"
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
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Order History
            </h2>

            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="text-center py-14">
                <ShoppingBag size={36} className="text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No past orders yet</p>
              </div>
            ) : (
              historyOrders.map(order => (
                <OrderCard key={order.id} order={order} onReorder={handleReorder} />
              ))
            )}
          </div>
        )}

        {/* ── Profile ───────────────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="space-y-5">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Profile
            </h2>

            {profileLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full name</label>
                  <input
                    type="text"
                    value={profile.full_name ?? ''}
                    onChange={e => setProfile(p => ({ ...p, full_name: e.target.value || null }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                    placeholder="Jane Smith"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={profile.phone ?? ''}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value || null }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red"
                    placeholder="07700 900000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Default delivery address
                  </label>
                  <textarea
                    value={profile.address ?? ''}
                    onChange={e => setProfile(p => ({ ...p, address: e.target.value || null }))}
                    rows={2}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white
                               placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red resize-none"
                    placeholder="123 High Street, Reigate"
                  />
                </div>

                {profileError && (
                  <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-sm text-red-300">{profileError}</p>
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="w-full bg-brand-red hover:bg-brand-red/90 disabled:opacity-60 text-white font-semibold
                             rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
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

        {/* ── Security ──────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Security
            </h2>

            {/* Password reset */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Password</h3>
              <p className="text-xs text-zinc-500 mb-4">
                We'll email a reset link to your inbox.
              </p>
              {resetSent ? (
                <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3.5 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-300">Reset email sent — check your inbox.</p>
                </div>
              ) : (
                <button
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white font-medium
                             rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Password Reset Email
                </button>
              )}
            </div>

            {/* Close account */}
            <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-1">Close Account</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Permanently deletes your account and anonymises your order history.
                This cannot be undone.
              </p>

              {closeError && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{closeError}</p>
                </div>
              )}

              {!closeConfirm ? (
                <button
                  onClick={() => setCloseConfirm(true)}
                  className="w-full bg-red-600/15 hover:bg-red-600/25 border border-red-600/40 text-red-400 font-medium
                             rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={13} />
                  Close My Account
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-300 mb-2">Are you absolutely sure?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloseConfirm(false)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCloseAccount}
                      disabled={closeLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold
                                 rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
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
