import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

async function getAnalyticsUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()
  const ok = perms?.role === 'owner' || (perms?.permissions ?? []).includes('Analytics')
  return ok ? user : null
}

export async function GET(request: NextRequest) {
  const user = await getAnalyticsUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const rawDays = searchParams.get('days') ?? '30'
  // Support "today" shorthand
  const days = rawDays === 'today' ? 1 : Math.min(Math.max(parseInt(rawDays), 1), 90)

  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, created_at, order_type, order_items(item_name, quantity, unit_price)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  const all       = orders ?? []
  const confirmed = all.filter(o => o.status !== 'pending')

  // ── Summary ────────────────────────────────────────────────────────────────
  const total_revenue   = confirmed.reduce((s, o) => s + Number(o.total_amount), 0)
  const total_orders    = confirmed.length
  const avg_order_value = total_orders > 0 ? total_revenue / total_orders : 0
  const delivered       = all.filter(o => o.status === 'delivered' || (o as Record<string, unknown>).delivery_status === 'delivered').length
  const completion_rate = all.length > 0 ? Math.round((delivered / all.length) * 100) : 0

  // ── Delivery vs collection split ───────────────────────────────────────────
  type OrderWithType = { order_type: string | null }
  const deliveryCount = confirmed.filter(o => (o as unknown as OrderWithType).order_type !== 'pickup').length
  const pickupCount   = confirmed.filter(o => (o as unknown as OrderWithType).order_type === 'pickup').length
  const delivery_pct  = confirmed.length > 0 ? Math.round((deliveryCount / confirmed.length) * 100) : 0
  const order_type_split = [
    { name: 'Delivery',   value: deliveryCount, pct: delivery_pct },
    { name: 'Collection', value: pickupCount,   pct: 100 - delivery_pct },
  ]

  // ── Daily (fill zeros for every day in range) ──────────────────────────────
  const dailyMap = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    dailyMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 })
  }
  // Always include today
  dailyMap.set(new Date().toISOString().slice(0, 10), dailyMap.get(new Date().toISOString().slice(0, 10)) ?? { revenue: 0, orders: 0 })

  for (const o of confirmed) {
    const key      = o.created_at.slice(0, 10)
    const existing = dailyMap.get(key)
    if (existing) {
      existing.revenue += Number(o.total_amount)
      existing.orders  += 1
    }
  }

  const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    revenue: Math.round(v.revenue * 100) / 100,
    orders:  v.orders,
  }))

  // ── Top items (by quantity sold, top 5) ────────────────────────────────────
  const itemMap = new Map<string, { revenue: number; quantity: number }>()
  for (const o of confirmed) {
    const items = (o.order_items as { item_name: string | null; quantity: number; unit_price: number }[]) ?? []
    for (const item of items) {
      const name    = item.item_name ?? 'Unknown'
      const rev     = Number(item.unit_price) * item.quantity
      const existing = itemMap.get(name)
      if (existing) {
        existing.revenue  += rev
        existing.quantity += item.quantity
      } else {
        itemMap.set(name, { revenue: rev, quantity: item.quantity })
      }
    }
  }

  const top_items = Array.from(itemMap.entries())
    .map(([name, v]) => ({ name, revenue: Math.round(v.revenue * 100) / 100, quantity: v.quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {}
  for (const o of all) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  const statusOrder    = ['pending', 'preparing', 'ready', 'dispatched', 'delivered']
  const status_breakdown = statusOrder
    .filter(s => (statusMap[s] ?? 0) > 0)
    .map(s => ({
      status: s,
      count:  statusMap[s] ?? 0,
      pct:    all.length > 0 ? Math.round(((statusMap[s] ?? 0) / all.length) * 100) : 0,
    }))

  // ── Day of week revenue (average per occurrence) ───────────────────────────
  const dowRevMap:   number[] = Array(7).fill(0)
  const dowCountMap: number[] = Array(7).fill(0)
  const dowOrderMap: number[] = Array(7).fill(0)

  for (const o of confirmed) {
    const dow = new Date(o.created_at).getDay()
    dowRevMap[dow]   += Number(o.total_amount)
    dowOrderMap[dow] += 1
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    dowCountMap[d.getDay()] += 1
  }

  const dow_revenue = DOW_LABELS.map((label, dow) => ({
    dow,
    label,
    revenue: dowCountMap[dow] > 0 ? Math.round((dowRevMap[dow] / dowCountMap[dow]) * 100) / 100 : 0,
    orders:  dowCountMap[dow] > 0 ? Math.round((dowOrderMap[dow] / dowCountMap[dow]) * 10) / 10 : 0,
  }))

  // ── Hourly distribution ────────────────────────────────────────────────────
  const hourMap: number[] = Array(24).fill(0)
  for (const o of confirmed) hourMap[new Date(o.created_at).getHours()] += 1
  const hourly_orders = hourMap.map((orders, hour) => ({ hour, orders }))

  return NextResponse.json({
    period_days: days,
    summary:          { total_revenue, total_orders, avg_order_value, completion_rate },
    order_type_split,
    delivery_pct,
    daily,
    top_items,
    status_breakdown,
    dow_revenue,
    hourly_orders,
  })
}
