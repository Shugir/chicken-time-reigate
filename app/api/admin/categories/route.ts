import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

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
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, image_url, description } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!slug?.trim()) return NextResponse.json({ error: 'slug is required' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = (existing?.sort_order ?? 0) + 1

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({
      name:        name.trim(),
      slug:        slug.trim(),
      sort_order,
      image_url:   image_url   || null,
      description: description || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
