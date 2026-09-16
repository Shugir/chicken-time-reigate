import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import { validatePromoPayload, type PromoPayload } from '@/lib/promo-form'

export async function GET(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Promotions')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  let dbQuery = supabaseAdmin
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })

  if (q) dbQuery = dbQuery.ilike('code', `%${q}%`)

  const { data, error } = await dbQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Promotions')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const payload: PromoPayload = {
    code:             body.code?.trim().toUpperCase() || null,
    promo_type:       body.promo_type ?? 'VOUCHER',
    discount_type:    body.discount_type,
    discount_value:   Number(body.discount_value),
    min_order_amount: Number(body.min_order_amount ?? 0),
    points_cost:      body.points_cost ?? null,
    min_tier_id:      body.min_tier_id ?? null,
    reward_config:    body.reward_config ?? {},
    start_date:       body.start_date ?? null,
    end_date:         body.end_date ?? null,
  }

  const validationError = validatePromoPayload(payload)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .insert({ ...payload, is_active: body.is_active ?? true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
