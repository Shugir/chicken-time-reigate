import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const PATCHABLE = new Set([
    'name', 'description', 'price', 'compare_at_price', 'image_url',
    'category', 'is_available', 'sold_out_extras', 'extras', 'removals',
    'additions', 'dietary_flags', 'allergens',
  ])
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => PATCHABLE.has(k)))

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update(patch)
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
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('menu_items')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
