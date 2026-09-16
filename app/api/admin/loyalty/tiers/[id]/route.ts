import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import { validateTier } from '../route'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Loyalty')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const validationError = validateTier(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.name       !== undefined) update.name       = body.name.trim()
  if (body.threshold  !== undefined) update.threshold  = Number(body.threshold)
  if (body.multiplier !== undefined) update.multiplier = Number(body.multiplier)
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)

  const { data, error } = await supabaseAdmin
    .from('loyalty_tiers')
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
  if (!perms || !hasPermission(perms, 'Loyalty')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Both FKs are ON DELETE SET NULL, so the rows survive but silently lose their
  // tier — report what was orphaned so the UI can say so.
  const [profiles, promos] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('current_tier_id', id),
    supabaseAdmin.from('promotions').select('id', { count: 'exact', head: true }).eq('min_tier_id', id),
  ])

  const { error } = await supabaseAdmin.from('loyalty_tiers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    orphaned_customers: profiles.count ?? 0,
    orphaned_rewards:   promos.count ?? 0,
  })
}
