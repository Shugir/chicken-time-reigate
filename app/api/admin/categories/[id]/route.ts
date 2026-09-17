import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Categories')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.name        !== undefined) update.name        = body.name
  if (body.slug        !== undefined) update.slug        = body.slug
  if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
  if (body.is_active   !== undefined) update.is_active   = body.is_active
  if (body.image_url   !== undefined) update.image_url   = body.image_url
  if (body.description !== undefined) update.description = body.description

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(update)
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
  if (!perms || !hasPermission(perms, 'Categories')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
