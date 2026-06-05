import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { name, phone, per_delivery_wage, is_active, status } = await request.json()

  const updates: Record<string, unknown> = {}
  if (name            !== undefined) updates.name             = name
  if (phone           !== undefined) updates.phone            = phone
  if (per_delivery_wage !== undefined) updates.per_delivery_wage = per_delivery_wage
  if (is_active       !== undefined) updates.is_active        = is_active
  if (status          !== undefined) updates.status           = status

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { error } = await supabaseAdmin
    .from('drivers')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
