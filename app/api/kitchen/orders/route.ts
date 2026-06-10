import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, created_at, customer_name, customer_phone, delivery_address, delivery_postcode, customer_notes, order_type, scheduled_for, order_items(id, item_name, quantity, unit_price, extras, removals, notes)')
    .in('status', ['preparing', 'ready', 'dispatched'])
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
