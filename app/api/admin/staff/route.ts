import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('staff_permissions')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { email, password, role, permissions } = await request.json()

  if (!email)    return NextResponse.json({ error: 'email is required' },    { status: 400 })
  if (!password) return NextResponse.json({ error: 'password is required' }, { status: 400 })

  const normalEmail = email.trim().toLowerCase()

  // Create the Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:         normalEmail,
    password,
    email_confirm: true,
  })

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
