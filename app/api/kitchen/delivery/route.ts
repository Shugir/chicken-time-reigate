import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, delivery_status, failure_reason, total_amount, created_at,
      driver_id,
      drivers(id, name, phone),
      order_items(id, item_name, quantity, unit_price, extras, removals, notes)
    `)
    .eq('delivery_status', 'out_for_delivery')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
