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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
