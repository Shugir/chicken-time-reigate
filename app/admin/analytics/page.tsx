'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, ShoppingBag, BarChart3, Loader2, RefreshCw, Target,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { formatDateShort, formatDateHeader } from '@/lib/utils/format-date'
import {
  ResponsiveContainer, ComposedChart, Area,
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Cell,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  total_revenue:    number
  total_orders:     number
  avg_order_value:  number
  completion_rate:  number
}
interface DailyPoint  { date: string; revenue: number; orders: number }
interface TopItem      { name: string; revenue: number; quantity: number }
interface StatusRow    { status: string; count: number; pct: number }
interface DowPoint     { dow: number; label: string; revenue: number; orders: number }
interface HourlyPoint  { hour: number; orders: number }

interface AnalyticsData {
  period_days:      number
  summary:          Summary
  daily:            DailyPoint[]
  top_items:        TopItem[]
  status_breakdown: StatusRow[]
  dow_revenue:      DowPoint[]
  hourly_orders:    HourlyPoint[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtGbp(n: number) { return `£${n.toFixed(2)}` }

function shortDate(iso: string) {
  return formatDateShort(iso)
}

const CHART_THEME = {
  gridStroke:    '#27272a',
  axisStroke:    '#52525b',
  tickFill:      '#71717a',
  tooltipBg:     '#18181b',
  tooltipBorder: '#3f3f46',
  red:           '#ef4444',
  blue:          '#3b82f6',
  amber:         '#f59e0b',
}

const STATUS_COLOURS: Record<string, string> = {
  pending:    'bg-zinc-600',
  preparing:  'bg-amber-500',
  ready:      'bg-blue-500',
  dispatched: 'bg-violet-500',
  delivered:  'bg-emerald-500',
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, fmtValue }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  fmtValue?: (v: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 shadow-xl text-sm min-w-[130px]">
      {label && <p className="text-zinc-400 text-xs mb-1.5 font-medium">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 text-xs capitalize">{p.name}</span>
          <span className="font-semibold text-white text-xs">
            {fmtValue ? fmtValue(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label:   string
  value:   string
  sub?:    string
  icon:    React.ElementType
  color:   'emerald' | 'blue' | 'amber' | 'violet'
  loading: boolean
}) {
  const p = {
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
    blue:    { bg: 'bg-blue-500/10',    icon: 'text-blue-400',    border: 'border-blue-500/20'    },
    amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   border: 'border-amber-500/20'   },
    violet:  { bg: 'bg-violet-500/10',  icon: 'text-violet-400',  border: 'border-violet-500/20'  },
  }[color]

  return (
    <div className={`bg-zinc-900 border ${p.border} rounded-2xl p-5 flex flex-col gap-3`}>
      <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${p.icon}`} />
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-28 bg-zinc-800 rounded-lg animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        )}
        <p className="text-sm text-zinc-500 mt-0.5">{label}</p>
        {sub && !loading && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [days, setDays]       = useState(30)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function fetchData(d = days, showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData(days) }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = formatDateHeader(new Date())

  const maxTopRevenue = data?.top_items[0]?.revenue ?? 1
  const maxHourly     = Math.max(...(data?.hourly_orders.map(h => h.orders) ?? [1]))

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Analytics</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.days}
                  onClick={() => setDays(p.days)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    days === p.days
                      ? 'bg-zinc-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchData(days, true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <div className="flex-1 px-8 py-6 space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value={data ? fmtGbp(data.summary.total_revenue) : '—'}
              sub={`${days}-day period`}
              icon={TrendingUp}
              color="emerald"
              loading={loading}
            />
            <StatCard
              label="Total Orders"
              value={data ? String(data.summary.total_orders) : '—'}
              sub={data ? `Avg ${(data.summary.total_orders / days).toFixed(1)}/day` : undefined}
              icon={ShoppingBag}
              color="blue"
              loading={loading}
            />
            <StatCard
              label="Avg Order Value"
              value={data ? fmtGbp(data.summary.avg_order_value) : '—'}
              icon={BarChart3}
              color="amber"
              loading={loading}
            />
            <StatCard
              label="Completion Rate"
              value={data ? `${data.summary.completion_rate}%` : '—'}
              sub="delivered / all orders"
              icon={Target}
              color="violet"
              loading={loading}
            />
          </div>

          {/* Revenue + Orders combined chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-white">Revenue & Orders</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Daily totals over the last {days} days</p>
            </div>
            <div className="px-4 pt-4 pb-2">
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                </div>
              ) : mounted && data?.daily.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={data.daily} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_THEME.red} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART_THEME.red} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_THEME.gridStroke} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={v => shortDate(v)}
                      tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                      axisLine={{ stroke: CHART_THEME.gridStroke }}
                      tickLine={false}
                      interval={days <= 7 ? 0 : days <= 30 ? 4 : 12}
                    />
                    <YAxis
                      yAxisId="rev"
                      orientation="left"
                      tickFormatter={v => `£${v}`}
                      tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <YAxis
                      yAxisId="ord"
                      orientation="right"
                      tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <ChartTooltip
                          active={active}
                          payload={payload?.map(p => ({ ...p, name: p.name as string, value: p.value as number, color: p.color as string }))}
                          label={label != null ? shortDate(String(label)) : undefined}
                          fmtValue={(v, name) => name === 'revenue' ? fmtGbp(Number(v)) : String(v)}
                        />
                      )}
                    />
                    <Area
                      yAxisId="rev"
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_THEME.red}
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: CHART_THEME.red }}
                    />
                    <Bar
                      yAxisId="ord"
                      dataKey="orders"
                      fill={CHART_THEME.blue}
                      opacity={0.4}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={20}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-zinc-600">No data</div>
              )}
              <div className="flex items-center gap-5 px-2 pb-2 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="w-3 h-0.5 bg-red-500 inline-block rounded" />Revenue
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="w-3 h-2.5 bg-blue-500/50 inline-block rounded" />Orders
                </span>
              </div>
            </div>
          </div>

          {/* Middle row: Top items + Status breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Top items */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-base font-semibold text-white">Top Items by Revenue</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{days}-day period</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 bg-zinc-800 rounded-lg animate-pulse" />
                  ))
                ) : !data?.top_items.length ? (
                  <p className="text-sm text-zinc-600 py-4 text-center">No data</p>
                ) : (
                  data.top_items.map((item, i) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-300 truncate max-w-[200px]">
                          <span className="text-zinc-600 mr-1.5 font-mono text-[10px]">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-xs text-zinc-500">{item.quantity}×</span>
                          <span className="text-xs font-semibold text-white w-16 text-right">
                            {fmtGbp(item.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-red rounded-full transition-all"
                          style={{ width: `${Math.round((item.revenue / maxTopRevenue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Order status breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-base font-semibold text-white">Order Status Breakdown</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{days}-day period</p>
              </div>
              <div className="px-6 py-4 space-y-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 bg-zinc-800 rounded-lg animate-pulse" />
                  ))
                ) : !data?.status_breakdown.length ? (
                  <p className="text-sm text-zinc-600 py-4 text-center">No data</p>
                ) : (
                  data.status_breakdown.map(row => (
                    <div key={row.status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-300 capitalize">{row.status}</span>
                        <span className="text-xs text-zinc-500">{row.count} ({row.pct}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_COLOURS[row.status] ?? 'bg-zinc-500'}`}
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom row: Day-of-week + Hourly */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Revenue by day of week */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-base font-semibold text-white">Revenue by Day of Week</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Average per weekday occurrence</p>
              </div>
              <div className="px-4 pt-4 pb-3">
                {loading ? (
                  <div className="h-44 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : mounted && data?.dow_revenue.length ? (
                  <ResponsiveContainer width="100%" height={176}>
                    <BarChart data={data.dow_revenue} margin={{ top: 4, right: 0, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_THEME.gridStroke} strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                        axisLine={{ stroke: CHART_THEME.gridStroke }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={v => `£${v}`}
                        tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload?.map(p => ({ ...p, name: p.name as string, value: p.value as number, color: p.color as string }))}
                            label={String(label)}
                            fmtValue={v => fmtGbp(v)}
                          />
                        )}
                      />
                      <Bar dataKey="revenue" fill={CHART_THEME.amber} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-sm text-zinc-600">No data</div>
                )}
              </div>
            </div>

            {/* Hourly distribution */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-base font-semibold text-white">Peak Order Hours</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Number of orders per hour of day</p>
              </div>
              <div className="px-4 pt-4 pb-3">
                {loading ? (
                  <div className="h-44 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : mounted && data?.hourly_orders.length ? (
                  <ResponsiveContainer width="100%" height={176}>
                    <BarChart
                      data={data.hourly_orders.filter(h => h.orders > 0 || [11,12,13,17,18,19,20,21].includes(h.hour))}
                      margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid stroke={CHART_THEME.gridStroke} strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={h => `${h}h`}
                        tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                        axisLine={{ stroke: CHART_THEME.gridStroke }}
                        tickLine={false}
                        interval={2}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: CHART_THEME.tickFill, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => (
                          <ChartTooltip
                            active={active}
                            payload={payload?.map(p => ({ ...p, name: p.name as string, value: p.value as number, color: p.color as string }))}
                            label={label != null ? `${String(label)}:00` : undefined}
                          />
                        )}
                      />
                      <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={24}>
                        {data?.hourly_orders
                          .filter(h => h.orders > 0 || [11,12,13,17,18,19,20,21].includes(h.hour))
                          .map((h, i) => (
                            <Cell
                              key={i}
                              fill={h.orders > maxHourly * 0.5 ? CHART_THEME.red : '#7f1d1d'}
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-sm text-zinc-600">No data</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
