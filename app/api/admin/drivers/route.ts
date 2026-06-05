import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select(`
      id, name, phone, status, per_delivery_wage, is_active, created_at,
      orders!orders_driver_id_fkey(delivery_status)
    `)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const drivers = (data ?? []).map((d) => {
    const completedDeliveries = (d.orders as Array<{ delivery_status: string | null }> ?? [])
      .filter((o) => o.delivery_status === 'delivered').length
    return {
      id:               d.id,
      name:             d.name,
      phone:            d.phone,
      status:           d.status,
      per_delivery_wage: d.per_delivery_wage,
      is_active:        d.is_active,
      created_at:       d.created_at,
      completed_deliveries: completedDeliveries,
      total_wages:      completedDeliveries * Number(d.per_delivery_wage),
    }
  })

  return NextResponse.json(drivers)
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
