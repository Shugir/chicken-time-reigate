import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { role, permissions, password } = await request.json()

  const update: Record<string, unknown> = {}
  if (role        !== undefined) update.role        = role
  if (permissions !== undefined) update.permissions = permissions

  const { data, error } = await supabaseAdmin
    .from('staff_permissions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update password if provided
  if (password) {
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const authUser = users.find((u) => u.email === data.email)
    if (authUser) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password })
      if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Get email before deleting record
  const { data: record } = await supabaseAdmin
    .from('staff_permissions')
    .select('email')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('staff_permissions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete auth user if found
  if (record?.email) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const authUser = users.find((u) => u.email === record.email)
    if (authUser) await supabaseAdmin.auth.admin.deleteUser(authUser.id)
  }

  return new NextResponse(null, { status: 204 })
}
