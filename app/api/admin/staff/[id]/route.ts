import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getStaffAdminUser() {
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
    .select('role')
    .eq('email', user.email!)
    .maybeSingle()
  return (perms?.role === 'owner' || perms?.role === 'admin') ? user : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getStaffAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { role, permissions } = await request.json()

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

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getStaffAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
