import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [{ data: drivers, error }, { data: activeOrders }] = await Promise.all([
    supabaseAdmin
      .from('drivers')
      .select('id, name, phone, status')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('orders')
      .select('driver_id')
      .eq('delivery_status', 'out_for_delivery'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const loadMap: Record<string, number> = {}
  for (const o of activeOrders ?? []) {
    if (o.driver_id) loadMap[o.driver_id] = (loadMap[o.driver_id] ?? 0) + 1
  }

  const result = (drivers ?? []).map((d) => ({
    ...d,
    active_orders: loadMap[d.id] ?? 0,
  }))

  return NextResponse.json(result)
}
