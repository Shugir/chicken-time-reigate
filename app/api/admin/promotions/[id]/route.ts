import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import { validatePromoPayload, type PromoPayload } from '@/lib/promo-form'

const EDITABLE_FIELDS = [
  'code', 'promo_type', 'discount_type', 'discount_value', 'min_order_amount',
  'points_cost', 'min_tier_id', 'reward_config', 'start_date', 'end_date', 'is_active',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Promotions')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field]
  }
  if (typeof update.code === 'string') update.code = update.code.trim().toUpperCase() || null

  // A partial patch (e.g. the active toggle) can't be validated on its own, so
  // merge it onto the stored row before checking the discount rules.
  if (update.discount_type !== undefined) {
    const { data: existing } = await supabaseAdmin
      .from('promotions').select('*').eq('id', id).single()
    if (!existing) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })

    // PostgREST can hand numeric columns back as strings, so coerce before the
    // Number.isFinite checks.
    const merged = { ...existing, ...update } as PromoPayload
    merged.discount_value   = Number(merged.discount_value)
    merged.min_order_amount = Number(merged.min_order_amount)

    const validationError = validatePromoPayload(merged)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('promotions')
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
  if (!perms || !hasPermission(perms, 'Promotions')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('promotions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
