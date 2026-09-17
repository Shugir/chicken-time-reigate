import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  // The menu manager needs the category list to file items under; editing the
  // list itself stays Categories-only.
  const perms = await getUserPermissions()
  if (!perms || !(hasPermission(perms, 'Categories') || hasPermission(perms, 'MenuManager'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Categories')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
