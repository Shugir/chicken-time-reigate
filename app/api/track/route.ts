import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id    = searchParams.get('id')?.trim()
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!id || !email) {
    return NextResponse.json({ error: 'Order ID and email are required' }, { status: 400 })
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, delivery_status, total_amount, created_at, customer_name, delivery_address, customer_email, order_items(item_name, quantity, unit_price)')
    .eq('id', id)
    .ilike('customer_email', email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'No order found with that ID and email' }, { status: 404 })

  const { customer_email: _, ...safeOrder } = order
  return NextResponse.json(safeOrder)
}
