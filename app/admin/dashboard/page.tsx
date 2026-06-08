'use client'

import { useState, useEffect } from 'react'
import {
  Tag, TrendingUp, ShoppingBag, BarChart3, Loader2, RefreshCw, Truck, Clock,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { formatDateShort, formatDateHeader } from '@/lib/utils/format-date'

interface OrderItem { item_name: string | null; quantity: number }
interface RecentOrder {
  id: string; status: string; total_amount: number; created_at: string; order_items: OrderItem[]
}
interface DashboardData {
  revenue_today: number; orders_today: number; avg_order_value: number; active_promotions: number
  drivers_online?: number; top_selling_combo?: string | null; revenue_yesterday?: number
  recent_orders: RecentOrder[]
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-zinc-700/60 text-zinc-300',
  preparing:  'bg-amber-500/20 text-amber-400',
  ready:      'bg-blue-500/20 text-blue-400',
  dispatched: 'bg-violet-500/20 text-violet-400',
  delivered:  'bg-emerald-500/20 text-emerald-400',
}
const STATUS_DOTS: Record<string, string> = {
  pending: 'bg-zinc-500', preparing: 'bg-amber-400', ready: 'bg-blue-400',
  dispatched: 'bg-violet-400', delivered: 'bg-emerald-400',
}

function shortId(id: string) { return '#' + id.replace(/-/g, '').substring(0, 6).toUpperCase() }
function formatItems(items: OrderItem[]): string {
  if (!items?.length) return '—'
  const names = items.slice(0, 2).map((i) => `${i.quantity}× ${i.item_name ?? '?'}`)
  return names.join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '')
}
function formatTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return formatDateShort(new Date(iso))
}

// ─── Bento Stat Card ─────────────────────────────────────────────────────────

function BentoCard({
  label, value, subLabel, icon: Icon, accent, loading, wide,
}: {
  label: string; value: string; subLabel?: string
  icon: React.ElementType; accent: string; loading: boolean; wide?: boolean
}) {
  const accents: Record<string, { icon: string; border: string; glow: string; badge: string }> = {
    emerald: { icon: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'bg-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-300' },
    blue:    { icon: 'text-blue-400',    border: 'border-blue-500/20',    glow: 'bg-blue-500/10',    badge: 'bg-blue-500/15 text-blue-300'    },
    amber:   { icon: 'text-amber-400',   border: 'border-amber-500/20',   glow: 'bg-amber-500/10',   badge: 'bg-amber-500/15 text-amber-300'   },
    violet:  { icon: 'text-violet-400',  border: 'border-violet-500/20',  glow: 'bg-violet-500/10',  badge: 'bg-violet-500/15 text-violet-300' },
    red:     { icon: 'text-red-400',     border: 'border-red-500/20',     glow: 'bg-red-500/10',     badge: 'bg-red-500/15 text-red-300'       },
  }
  const p = accents[accent] ?? accents.blue

  return (
    <div className={`bg-zinc-900 border ${p.border} rounded-2xl p-6 flex flex-col gap-5 shadow-sm ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl ${p.glow} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${p.icon}`} />
        </div>
        {subLabel && (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${p.badge}`}>{subLabel}</span>
        )}
      </div>
      <div>
        {loading ? (
          <div className="h-9 w-28 bg-zinc-800 rounded-lg animate-pulse mb-1.5" />
        ) : (
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        )}
        <p className="text-sm text-zinc-500 mt-1.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData]             = useState<DashboardData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (res.ok) setData(await res.json())
    } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { fetchData() }, [])

  const revenueChange = data?.revenue_yesterday != null && data.revenue_yesterday > 0
    ? ((data.revenue_today - data.revenue_yesterday) / data.revenue_yesterday * 100)
    : null
  const revenueSubLabel = revenueChange != null
    ? `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(0)}% vs yesterday`
    : 'Today'

  const bentoCards = [
    { label: "Today's Revenue",   value: data ? `£${data.revenue_today.toFixed(2)}` : '—',           subLabel: revenueSubLabel,                        icon: TrendingUp, accent: 'emerald', wide: false },
    { label: 'Active Orders',     value: data ? String(data.orders_today) : '—',                       subLabel: 'In progress',                          icon: ShoppingBag, accent: 'blue',   wide: false },
    { label: 'Drivers Online',    value: data?.drivers_online != null ? String(data.drivers_online) : '—', subLabel: 'On shift',                         icon: Truck,      accent: 'amber',  wide: false },
    { label: 'Top Selling Combo', value: data?.top_selling_combo ?? '—',                               subLabel: data?.top_selling_combo ? 'Today' : undefined, icon: Tag, accent: 'violet', wide: false },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{formatDateHeader(new Date())}</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        <div className="flex-1 px-8 py-6 space-y-6">
          {/* Bento grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {bentoCards.map((c) => (
              <BentoCard key={c.label} {...c} loading={loading} />
            ))}
          </div>

          {/* Recent orders */}
          <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-zinc-500" />
                <h2 className="text-base font-semibold text-white">Recent Orders</h2>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2.5 py-1 rounded-full">Last 10</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-7 h-7 text-zinc-600 animate-spin" />
              </div>
            ) : !data?.recent_orders.length ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <ShoppingBag className="w-10 h-10 text-zinc-800 mb-3" />
                <p className="text-zinc-500 text-sm font-medium">No orders yet</p>
                <p className="text-zinc-700 text-xs mt-1">Orders will appear here once customers start buying</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60 bg-zinc-900/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {data.recent_orders.map((order) => {
                    const ss = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending
                    const ds = STATUS_DOTS[order.status]   ?? STATUS_DOTS.pending
                    return (
                      <tr key={order.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="font-mono text-xs font-semibold text-zinc-300">{shortId(order.id)}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-zinc-400 text-xs">{formatItems(order.order_items)}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${ss}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ds}`} />
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="font-semibold text-white">£{Number(order.total_amount).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="text-zinc-600 text-xs">{formatTime(order.created_at)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
