import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id    = searchParams.get('id')?.trim()
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
  }

  // Email optional: manual form lookups pass it as second factor.
  // UUID-based direct links (e.g. /track/[id]) skip email — 128-bit UUID is the token.
  let query = supabaseAdmin
    .from('orders')
    .select('id, status, delivery_status, order_type, total_amount, scheduled_for, created_at, customer_name, delivery_address, customer_email, driver_id, order_items(item_name, quantity, unit_price)')
    .eq('id', id)

  if (email) {
    query = query.ilike('customer_email', email)
  }

  const { data: order, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Resolve driver name from drivers table if assigned
  let driver_name: string | null = null
  if (order.driver_id) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('name')
      .eq('id', order.driver_id)
      .maybeSingle()
    driver_name = driver?.name ?? null
  }

  const { customer_email: _, ...safeOrder } = order
  return NextResponse.json({ ...safeOrder, driver_name })
}
