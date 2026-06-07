import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendOrderStatusEmail } from '@/lib/email'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { status, driver_id, delivery_status } = await request.json()

  // Fetch current driver when we need to manage driver status transitions
  const needsDriverLookup =
    status === 'preparing' || // revert: must free old driver
    (driver_id !== undefined && status === undefined) // reassign: swap old → new
  let oldDriverId: string | null = null
  if (needsDriverLookup) {
    const { data } = await supabaseAdmin.from('orders').select('driver_id').eq('id', id).single()
    oldDriverId = data?.driver_id ?? null
  }

  const updates: Record<string, unknown> = {}
  if (status          !== undefined) updates.status          = status
  if (driver_id       !== undefined) updates.driver_id       = driver_id
  if (delivery_status !== undefined) updates.delivery_status = delivery_status

  const { data: updatedOrder, error } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select('id, customer_name, total_amount, delivery_address, user_id, order_items(item_name, quantity)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Driver status management
  if (status === 'preparing' && oldDriverId) {
    // Revert to prep: free the previously assigned driver
    await supabaseAdmin.from('drivers').update({ status: 'available' }).eq('id', oldDriverId)
  } else if (status === 'dispatched' && driver_id) {
    // Initial dispatch: mark driver on_delivery
    await supabaseAdmin.from('drivers').update({ status: 'on_delivery' }).eq('id', driver_id)
  } else if (driver_id !== undefined && driver_id !== null && status === undefined) {
    // Reassignment: free old driver, assign new
    if (oldDriverId && oldDriverId !== driver_id) {
      await supabaseAdmin.from('drivers').update({ status: 'available' }).eq('id', oldDriverId)
    }
    await supabaseAdmin.from('drivers').update({ status: 'on_delivery' }).eq('id', driver_id)
  }

  // Fire status emails — skip revert (preparing) and reassign-only patches
  const emailStatus = status === 'dispatched' ? 'out_for_delivery'
    : delivery_status === 'out_for_delivery' ? 'out_for_delivery'
    : null

  if (emailStatus && updatedOrder?.user_id) {
    supabaseAdmin.auth.admin.getUserById(updatedOrder.user_id).then(({ data }) => {
      if (!data.user?.email) return
      const items = (updatedOrder.order_items as Array<{ item_name: string | null; quantity: number }> ?? [])
        .map((i) => ({ name: i.item_name ?? 'Item', quantity: i.quantity }))
      sendOrderStatusEmail(
        {
          id:               updatedOrder.id,
          customer_name:    updatedOrder.customer_name,
          total_amount:     Number(updatedOrder.total_amount),
          delivery_address: updatedOrder.delivery_address,
          items,
        },
        emailStatus,
        data.user.email,
      )
    })
  }

  return NextResponse.json({ success: true })
}
