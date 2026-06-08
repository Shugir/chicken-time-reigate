import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getAdminUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()
  const ok = perms?.role === 'owner' || (perms?.permissions ?? []).includes('Fleet')
  return ok ? user : null
}

const ORDER_FIELDS = `
  id, customer_name, customer_phone, customer_notes,
  delivery_address, delivery_postcode, total_amount, created_at,
  status, driver_id, stop_sequence, delivery_status, driver_notes,
  order_items(id, item_name, quantity, unit_price, extras, removals, notes)
`

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: unassigned }, { data: drivers }, { data: assigned }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .is('driver_id', null)
      .eq('status', 'ready')
      .order('created_at', { ascending: true }),

    supabaseAdmin
      .from('drivers')
      .select('id, name, status, phone')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    supabaseAdmin
      .from('orders')
      .select(ORDER_FIELDS)
      .not('driver_id', 'is', null)
      .eq('delivery_status', 'out_for_delivery')
      .order('stop_sequence', { ascending: true }),
  ])

  const driverMap = (drivers ?? []).map((d) => ({
    ...d,
    orders: (assigned ?? [])
      .filter((o) => o.driver_id === d.id)
      .sort((a, b) => (a.stop_sequence ?? 1) - (b.stop_sequence ?? 1)),
  }))

  return NextResponse.json({ unassigned: unassigned ?? [], drivers: driverMap })
}

export async function PATCH(req: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { order_id, driver_id, stop_sequence, action, failure_reason, driver_notes } = body as {
    order_id: string
    driver_id?: string | null
    stop_sequence?: number
    action?: 'delivered' | 'failed' | 'send_back'
    failure_reason?: string
    driver_notes?: string
  }

  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  const update: Record<string, unknown> = {}

  // ── Action shortcuts ──────────────────────────────────────────────────────
  if (action === 'delivered') {
    update.delivery_status = 'delivered'
    update.status = 'delivered'
  } else if (action === 'failed') {
    update.delivery_status = 'failed'
    update.failure_reason = failure_reason ?? 'Unknown'
  } else if (action === 'send_back') {
    // Tri-app sync: status → 'preparing' broadcasts to kitchen realtime listener
    update.status = 'preparing'
    update.delivery_status = null
    update.driver_id = null
    update.stop_sequence = 1
  }

  // ── Driver note ───────────────────────────────────────────────────────────
  if (typeof driver_notes !== 'undefined') {
    update.driver_notes = driver_notes
  }

  // ── Driver assignment ─────────────────────────────────────────────────────
  if (typeof driver_id !== 'undefined' && !action) {
    update.driver_id = driver_id ?? null
    if (driver_id) {
      update.delivery_status = 'out_for_delivery'
      update.status = 'dispatched'
      if (typeof stop_sequence === 'undefined') {
        const { data: existing } = await supabaseAdmin
          .from('orders')
          .select('stop_sequence')
          .eq('driver_id', driver_id)
          .eq('delivery_status', 'out_for_delivery')
          .neq('id', order_id)
          .order('stop_sequence', { ascending: false })
          .limit(1)
        update.stop_sequence = existing && existing.length > 0
          ? existing[0].stop_sequence + 1
          : 1
      }
    } else {
      update.delivery_status = null
      update.status = 'ready'
      update.stop_sequence = 1
    }
  }

  // ── Stop sequence (with conflict resolution) ──────────────────────────────
  if (typeof stop_sequence !== 'undefined' && stop_sequence !== null && !action) {
    let resolvedDriverId: string | null =
      typeof driver_id !== 'undefined' ? driver_id ?? null : null

    if (!resolvedDriverId) {
      const { data: current } = await supabaseAdmin
        .from('orders')
        .select('driver_id')
        .eq('id', order_id)
        .maybeSingle()
      resolvedDriverId = current?.driver_id ?? null
    }

    if (resolvedDriverId) {
      const { data: conflict } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('driver_id', resolvedDriverId)
        .eq('stop_sequence', stop_sequence)
        .eq('delivery_status', 'out_for_delivery')
        .neq('id', order_id)
        .maybeSingle()

      if (conflict) {
        await supabaseAdmin
          .from('orders')
          .update({ stop_sequence: stop_sequence + 1 })
          .eq('id', conflict.id)
      }
    }

    update.stop_sequence = stop_sequence
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update(update)
    .eq('id', order_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
