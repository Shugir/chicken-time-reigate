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
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, price, image_url, category, is_available, sold_out_extras, extras, removals, additions, dietary_flags, allergens } = await request.json()

  if (!name || !price || !category) {
    return NextResponse.json({ error: 'name, price, and category are required' }, { status: 400 })
  }

  const payload = {
    name,
    description: description ?? null,
    price,
    image_url: image_url ?? null,
    category,
    is_available: is_available ?? true,
    sold_out_extras: sold_out_extras ?? [],
    extras: extras ?? [],
    removals: removals ?? [],
    additions: additions ?? [],
    dietary_flags: dietary_flags ?? [],
    allergens: allergens ?? [],
  }

  console.log('Inserting menu item:', JSON.stringify(payload))

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
