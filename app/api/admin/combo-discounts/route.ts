import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getMenuAdminUser() {
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
  const ok = perms?.role === 'owner' || perms?.role === 'admin' || (perms?.permissions ?? []).includes('Menu')
  return ok ? user : null
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .select('*')
    .order('meal_size')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { meal_size, name, discount_amount, is_active = true } = await request.json()

  if (!meal_size || !['medium', 'large'].includes(meal_size)) {
    return NextResponse.json({ error: 'meal_size must be medium or large' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const amount = parseFloat(discount_amount)
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'discount_amount must be a non-negative number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .insert({ meal_size, name: name.trim(), discount_amount: amount, is_active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
