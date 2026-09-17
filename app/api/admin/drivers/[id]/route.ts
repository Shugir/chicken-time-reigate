import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Fleet')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { name, phone, per_delivery_wage, is_active, status, user_id } = await request.json()

  const updates: Record<string, unknown> = {}
  if (name              !== undefined) updates.name              = name
  if (phone             !== undefined) updates.phone             = phone
  if (per_delivery_wage !== undefined) updates.per_delivery_wage = per_delivery_wage
  if (is_active         !== undefined) updates.is_active         = is_active
  if (status            !== undefined) updates.status            = status
  if (user_id           !== undefined) updates.user_id           = user_id ?? null

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This user is already assigned to another driver.' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Fleet')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('drivers')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
