import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildDriverOrderUpdate } from '@/lib/order-status'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()

  const hasDriverPerm = perms?.role === 'owner' || (perms?.permissions ?? []).includes('Driver')
  if (!hasDriverPerm) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  const { action, return_reason } = await request.json()

  if (!['delivered', 'return_to_kitchen'].includes(action)) {
    return NextResponse.json({ error: 'action must be delivered or return_to_kitchen' }, { status: 400 })
  }

  // Verify this order belongs to this driver and is still out for delivery
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('id', id)
    .eq('driver_id', driver.id)
    .eq('delivery_status', 'out_for_delivery')
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found or already completed' }, { status: 404 })

  await supabaseAdmin
    .from('orders')
    .update(buildDriverOrderUpdate(action, return_reason ?? undefined))
    .eq('id', id)

  // Free the driver either way
  await supabaseAdmin
    .from('drivers')
    .update({ status: 'available' })
    .eq('id', driver.id)

  return NextResponse.json({ success: true })
}
