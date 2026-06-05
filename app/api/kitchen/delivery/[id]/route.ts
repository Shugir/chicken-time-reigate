import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { delivery_status, failure_reason } = await request.json()

  if (!['delivered', 'failed'].includes(delivery_status)) {
    return NextResponse.json({ error: 'delivery_status must be delivered or failed' }, { status: 400 })
  }

  const orderUpdates: Record<string, unknown> = { delivery_status }
  if (delivery_status === 'failed' && failure_reason) {
    orderUpdates.failure_reason = failure_reason
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .update(orderUpdates)
    .eq('id', id)
    .select('driver_id')
    .single()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  if (order?.driver_id) {
    await supabaseAdmin
      .from('drivers')
      .update({ status: 'available' })
      .eq('id', order.driver_id)
  }

  return NextResponse.json({ success: true })
}
