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

export async function GET(request: NextRequest) {
  const user = await getStaffAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q    = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const role = request.nextUrl.searchParams.get('role')?.trim() ?? ''

  let dbQuery = supabaseAdmin
    .from('staff_permissions')
    .select('*')
    .order('created_at', { ascending: true })

  if (q)    dbQuery = dbQuery.ilike('email', `%${q}%`)
  if (role) dbQuery = dbQuery.eq('role', role)

  const { data, error } = await dbQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getStaffAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role, permissions } = await request.json()

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const normalEmail = email.trim().toLowerCase()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalEmail)

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Insert permissions record
  const { data, error } = await supabaseAdmin
    .from('staff_permissions')
    .insert({
      email:       normalEmail,
      role:        role        ?? 'staff',
      permissions: permissions ?? [],
      user_id:     authData.user.id,
    })
    .select()
    .single()

  if (error) {
    // Roll back auth user creation
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
