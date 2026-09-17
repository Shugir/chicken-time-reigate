import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Fleet')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const { data: driver, error: driverErr } = await supabaseAdmin
    .from('drivers')
    .select('id, name, phone, status, per_delivery_wage, is_active')
    .eq('id', id)
    .single()

  if (driverErr || !driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  // Deliveries in selected date range
  let q = supabaseAdmin
    .from('orders')
    .select('id, customer_name, delivery_address, total_amount, created_at, is_driver_paid')
    .eq('driver_id', id)
    .eq('delivery_status', 'delivered')
    .order('created_at', { ascending: false })

  if (from) q = q.gte('created_at', `${from}T00:00:00.000Z`)
  if (to)   q = q.lte('created_at', `${to}T23:59:59.999Z`)

  const { data: deliveries, error: deliveriesErr } = await q
  if (deliveriesErr) return NextResponse.json({ error: deliveriesErr.message }, { status: 500 })

  // All-time unpaid count (for pending balance card, independent of date filter)
  const { data: allUnpaid } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('driver_id', id)
    .eq('delivery_status', 'delivered')
    .eq('is_driver_paid', false)

  const pending_count   = allUnpaid?.length ?? 0
  const pending_balance = pending_count * Number(driver.per_delivery_wage)

  // Payout history
  const { data: payouts } = await supabaseAdmin
    .from('driver_payouts')
    .select('id, amount, pay_period_start, pay_period_end, created_at')
    .eq('driver_id', id)
    .order('created_at', { ascending: false })

  const lifetime_paid = (payouts ?? []).reduce((s, p) => s + Number(p.amount), 0)

  return NextResponse.json({
    driver,
    deliveries:      deliveries ?? [],
    pending_count,
    pending_balance,
    lifetime_paid,
    payouts:         payouts ?? [],
  })
}

export async function POST(_request: NextRequest, { params }: Params) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Fleet')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('per_delivery_wage')
    .eq('id', id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { data: unpaid, error: unpaidErr } = await supabaseAdmin
    .from('orders')
    .select('id, created_at')
    .eq('driver_id', id)
    .eq('delivery_status', 'delivered')
    .eq('is_driver_paid', false)

  if (unpaidErr) return NextResponse.json({ error: unpaidErr.message }, { status: 500 })
  if (!unpaid || unpaid.length === 0) {
    return NextResponse.json({ error: 'No pending deliveries to settle' }, { status: 400 })
  }

  const amount = unpaid.length * Number(driver.per_delivery_wage)
  const dates  = unpaid.map((o) => o.created_at.slice(0, 10)).sort()

  const { data: payout, error: payoutErr } = await supabaseAdmin
    .from('driver_payouts')
    .insert({
      driver_id:        id,
      amount,
      pay_period_start: dates[0],
      pay_period_end:   dates[dates.length - 1],
    })
    .select()
    .single()

  if (payoutErr) return NextResponse.json({ error: payoutErr.message }, { status: 500 })

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ is_driver_paid: true })
    .eq('driver_id', id)
    .eq('delivery_status', 'delivered')
    .eq('is_driver_paid', false)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ payout, settled_count: unpaid.length, amount })
}
