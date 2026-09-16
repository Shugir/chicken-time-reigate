import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export function validateTier(body: {
  name?: unknown; threshold?: unknown; multiplier?: unknown; sort_order?: unknown
}): string | null {
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return 'name is required'
  }
  if (body.threshold !== undefined) {
    const t = Number(body.threshold)
    if (!Number.isInteger(t) || t < 0) return 'threshold must be a non-negative integer'
  }
  if (body.multiplier !== undefined) {
    const m = Number(body.multiplier)
    if (!Number.isFinite(m) || m <= 0) return 'multiplier must be a positive number'
  }
  if (body.sort_order !== undefined && !Number.isInteger(Number(body.sort_order))) {
    return 'sort_order must be an integer'
  }
  return null
}

export async function GET() {
  // The promotions form needs tier names to configure a reward's minimum tier,
  // so reading the list is allowed for either permission; writing stays Loyalty-only.
  const perms = await getUserPermissions()
  if (!perms || !(hasPermission(perms, 'Loyalty') || hasPermission(perms, 'Promotions'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [tiers, profiles, promos] = await Promise.all([
    supabaseAdmin.from('loyalty_tiers').select('*').order('sort_order', { ascending: true }),
    supabaseAdmin.from('profiles').select('current_tier_id').not('current_tier_id', 'is', null),
    supabaseAdmin.from('promotions').select('min_tier_id').not('min_tier_id', 'is', null),
  ])

  if (tiers.error) return NextResponse.json({ error: tiers.error.message }, { status: 500 })

  const customerCounts = new Map<string, number>()
  for (const p of profiles.data ?? []) {
    customerCounts.set(p.current_tier_id, (customerCounts.get(p.current_tier_id) ?? 0) + 1)
  }
  const rewardCounts = new Map<string, number>()
  for (const p of promos.data ?? []) {
    rewardCounts.set(p.min_tier_id, (rewardCounts.get(p.min_tier_id) ?? 0) + 1)
  }

  return NextResponse.json((tiers.data ?? []).map((t) => ({
    ...t,
    customer_count: customerCounts.get(t.id) ?? 0,
    reward_count:   rewardCounts.get(t.id) ?? 0,
  })))
}

export async function POST(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Loyalty')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (body.name === undefined) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const validationError = validateTier(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data: last } = await supabaseAdmin
    .from('loyalty_tiers')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('loyalty_tiers')
    .insert({
      name:       body.name.trim(),
      threshold:  Number(body.threshold ?? 0),
      multiplier: Number(body.multiplier ?? 1),
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ...data, customer_count: 0, reward_count: 0 }, { status: 201 })
}
