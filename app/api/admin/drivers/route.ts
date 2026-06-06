import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select(`
      id, name, phone, status, per_delivery_wage, is_active, created_at, user_id,
      orders!orders_driver_id_fkey(delivery_status, is_driver_paid)
    `)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type OrderRow = { delivery_status: string | null; is_driver_paid: boolean }

  const drivers = (data ?? []).map((d) => {
    const orders         = (d.orders as OrderRow[]) ?? []
    const successful_drops = orders.filter((o) => o.delivery_status === 'delivered').length
    const failed_returns   = orders.filter((o) => o.delivery_status === 'failed').length
    const unpaid_count     = orders.filter((o) => o.delivery_status === 'delivered' && !o.is_driver_paid).length
    const pending_wages    = unpaid_count * Number(d.per_delivery_wage)
    return {
      id:                  d.id,
      name:                d.name,
      phone:               d.phone,
      status:              d.status,
      per_delivery_wage:   d.per_delivery_wage,
      is_active:           d.is_active,
      created_at:          d.created_at,
      user_id:             d.user_id ?? null,
      completed_deliveries: successful_drops,
      total_wages:         successful_drops * Number(d.per_delivery_wage),
      successful_drops,
      failed_returns,
      pending_wages,
    }
  })

  const total_pending_payroll = drivers.reduce((s, d) => s + d.pending_wages, 0)
  const all_delivered         = drivers.reduce((s, d) => s + d.successful_drops, 0)
  const all_failed            = drivers.reduce((s, d) => s + d.failed_returns, 0)
  const fleet_success_rate    = (all_delivered + all_failed) > 0
    ? Math.round((all_delivered / (all_delivered + all_failed)) * 100)
    : 0
  const active_roster         = (data ?? []).filter(
    (d) => d.is_active && (d.status === 'available' || d.status === 'on_delivery'),
  ).length

  return NextResponse.json({
    drivers,
    aggregates: {
      total_pending_payroll,
      fleet_success_rate,
      total_shrinkage: all_failed,
      active_roster,
    },
  })
}

export async function POST(request: NextRequest) {
  const { name, phone, per_delivery_wage } = await request.json()

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .insert({ name, phone: phone ?? null, per_delivery_wage: per_delivery_wage ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
