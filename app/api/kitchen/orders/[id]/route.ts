import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { status, driver_id, delivery_status } = await request.json()

  const updates: Record<string, unknown> = {}
  if (status          !== undefined) updates.status          = status
  if (driver_id       !== undefined) updates.driver_id       = driver_id
  if (delivery_status !== undefined) updates.delivery_status = delivery_status

  const { error } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When dispatching with a driver, mark driver as on_delivery
  if (status === 'dispatched' && driver_id) {
    await supabaseAdmin
      .from('drivers')
      .update({ status: 'on_delivery' })
      .eq('id', driver_id)
  }

  return NextResponse.json({ success: true })
}
