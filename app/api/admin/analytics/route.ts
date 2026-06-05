import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30'), 7), 90)

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  // Fetch all non-pending orders in the period (with their items)
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, created_at, order_items(item_name, quantity, unit_price)')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  const all = orders ?? []
  const confirmed = all.filter(o => o.status !== 'pending')

  // ── Summary ────────────────────────────────────────────────────────────────
  const total_revenue   = confirmed.reduce((s, o) => s + Number(o.total_amount), 0)
  const total_orders    = confirmed.length
  const avg_order_value = total_orders > 0 ? total_revenue / total_orders : 0
  const delivered       = all.filter(o => o.status === 'delivered' || (o as Record<string, unknown>).delivery_status === 'delivered').length
  const completion_rate = all.length > 0 ? Math.round((delivered / all.length) * 100) : 0

  // ── Daily (fill zeros for every day in range) ──────────────────────────────
  const dailyMap = new Map<string, { revenue: number; orders: number }>()

  for (let i = 0; i <= days; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    dailyMap.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 })
  }

  for (const o of confirmed) {
    const key = o.created_at.slice(0, 10)
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

  // ── Top items by revenue ───────────────────────────────────────────────────
  const itemMap = new Map<string, { revenue: number; quantity: number }>()

  for (const o of confirmed) {
    const items = (o.order_items as { item_name: string | null; quantity: number; unit_price: number }[]) ?? []
    for (const item of items) {
      const name = item.item_name ?? 'Unknown'
      const rev  = Number(item.unit_price) * item.quantity
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
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {}
  for (const o of all) {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  }
  const statusOrder = ['pending', 'preparing', 'ready', 'dispatched', 'delivered']
  const status_breakdown = statusOrder
    .filter(s => (statusMap[s] ?? 0) > 0)
    .map(s => ({
      status: s,
      count:  statusMap[s] ?? 0,
      pct:    all.length > 0 ? Math.round(((statusMap[s] ?? 0) / all.length) * 100) : 0,
    }))

  // ── Day of week revenue (average per occurrence) ───────────────────────────
  const dowRevMap: number[] = Array(7).fill(0)
  const dowCountMap: number[] = Array(7).fill(0)
  const dowOrderMap: number[] = Array(7).fill(0)

  for (const o of confirmed) {
    const dow = new Date(o.created_at).getDay()
    dowRevMap[dow]   += Number(o.total_amount)
    dowOrderMap[dow] += 1
  }
  // Count how many of each weekday fall in the period
  for (let i = 0; i <= days; i++) {
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
  for (const o of confirmed) {
    const hour = new Date(o.created_at).getHours()
    hourMap[hour] += 1
  }
  const hourly_orders = hourMap.map((orders, hour) => ({ hour, orders }))

  return NextResponse.json({
    period_days: days,
    summary: { total_revenue, total_orders, avg_order_value, completion_rate },
    daily,
    top_items,
    status_breakdown,
    dow_revenue,
    hourly_orders,
  })
}
