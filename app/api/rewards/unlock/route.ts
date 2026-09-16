import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { promotion_id } = await request.json()
  if (!promotion_id) return NextResponse.json({ error: 'promotion_id required' }, { status: 400 })

  // Fetch the reward
  const { data: promo } = await supabaseAdmin
    .from('promotions')
    .select('id, promo_type, points_cost, is_active')
    .eq('id', promotion_id)
    .eq('promo_type', 'REWARD')
    .eq('is_active', true)
    .maybeSingle()

  if (!promo) return NextResponse.json({ error: 'Reward not found or inactive' }, { status: 404 })
  if (!promo.points_cost || promo.points_cost <= 0) {
    return NextResponse.json({ error: 'Invalid points cost for this reward' }, { status: 400 })
  }

  // Check user already unlocked this
  const { data: existing } = await supabaseAdmin
    .from('unlocked_rewards')
    .select('id')
    .eq('user_id', user.id)
    .eq('promotion_id', promotion_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'You have already unlocked this reward' }, { status: 409 })

  // Deduct atomically: the RPC's UPDATE carries the balance condition, so a
  // concurrent redemption can't slip past a separate check and overdraw.
  const { data: newBalance, error: redeemError } = await supabaseAdmin
    .rpc('redeem_loyalty_points', { uid: user.id, cost: promo.points_cost })

  if (redeemError) return NextResponse.json({ error: redeemError.message }, { status: 500 })

  if (newBalance === null) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('loyalty_points')
      .eq('id', user.id)
      .maybeSingle()
    const balance = profile?.loyalty_points ?? 0
    return NextResponse.json({ error: `Not enough points. Need ${promo.points_cost}, have ${balance}.` }, { status: 422 })
  }

  await supabaseAdmin.from('loyalty_transactions').insert({
    user_id: user.id, points: -promo.points_cost, type: 'redeem',
    note: `Unlocked reward: ${promotion_id}`,
  })
  const { error: unlockError } = await supabaseAdmin.from('unlocked_rewards').insert({
    user_id: user.id, promotion_id,
  })

  if (unlockError) return NextResponse.json({ error: unlockError.message }, { status: 500 })

  return NextResponse.json({ success: true, new_balance: newBalance })
}
