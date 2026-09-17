import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  // The menu manager renders the same metric tiles at the top of its page.
  const perms = await getUserPermissions()
  if (!perms || !(hasPermission(perms, 'Dashboard') || hasPermission(perms, 'MenuManager'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const [ordersToday, activePromos, recentOrders] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, status, total_amount')
      .gte('created_at', todayIso),
    supabaseAdmin
      .from('promotions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('orders')
      .select('id, status, order_type, total_amount, created_at, order_items(item_name, quantity)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const allToday   = ordersToday.data ?? []
  const confirmed  = allToday.filter((o) => o.status !== 'pending')
  const revenueToday  = confirmed.reduce((s, o) => s + Number(o.total_amount), 0)
  const avgOrderValue = confirmed.length > 0 ? revenueToday / confirmed.length : 0

  return NextResponse.json({
    revenue_today:     revenueToday,
    orders_today:      allToday.length,
    avg_order_value:   avgOrderValue,
    active_promotions: activePromos.count ?? 0,
    recent_orders:     (recentOrders.data ?? []).map((o) => ({ ...o, order_type: o.order_type ?? 'delivery' })),
  })
}
