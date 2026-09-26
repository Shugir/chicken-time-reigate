import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import { validateMenuItemInput } from '@/lib/menu-item-input'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // 22P02 = invalid input syntax, i.e. the id is not a valid uuid
  if (error && error.code !== '22P02') return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'MenuManager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const input = validateMenuItemInput(await request.json().catch(() => null), { partial: true })
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })
  if (Object.keys(input.value).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .update(input.value)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
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
