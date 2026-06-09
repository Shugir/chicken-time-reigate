import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Try to get authed user — optional (guests see rewards, just can't unlock)
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabaseClient.auth.getUser()

  const now = new Date().toISOString()

  // Fetch active REWARD promos within date window
  const { data: rewards, error } = await supabaseAdmin
    .from('promotions')
    .select('id, code, discount_type, discount_value, min_order_amount, points_cost, start_date, end_date')
    .eq('promo_type', 'REWARD')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('points_cost', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If authed, fetch this user's unlocked rewards
  let unlocked: { promotion_id: string; used_at: string | null }[] = []
  if (user) {
    const { data } = await supabaseAdmin
      .from('unlocked_rewards')
      .select('promotion_id, used_at')
      .eq('user_id', user.id)
    unlocked = data ?? []
  }

  const unlockedMap = new Map(unlocked.map((u) => [u.promotion_id, u.used_at]))

  const enriched = (rewards ?? []).map((r) => ({
    ...r,
    is_unlocked: unlockedMap.has(r.id),
    used_at: unlockedMap.get(r.id) ?? null,
  }))

  return NextResponse.json(enriched)
}
