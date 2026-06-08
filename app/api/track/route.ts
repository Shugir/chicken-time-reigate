import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id    = searchParams.get('id')?.trim()
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!id) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('orders')
    .select('id, status, delivery_status, total_amount, created_at, customer_name, delivery_address, customer_email, order_items(item_name, quantity, unit_price)')
    .eq('id', id)

  if (email) {
    query = query.ilike('customer_email', email)
  }

  const { data: order, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { customer_email: _, ...safeOrder } = order
  return NextResponse.json(safeOrder)
}
