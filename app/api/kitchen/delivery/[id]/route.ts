import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildKitchenDeliveryUpdate } from '@/lib/order-status'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { delivery_status, failure_reason } = await request.json()

  if (!['delivered', 'failed'].includes(delivery_status)) {
    return NextResponse.json({ error: 'delivery_status must be delivered or failed' }, { status: 400 })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .update(buildKitchenDeliveryUpdate(delivery_status, failure_reason))
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
