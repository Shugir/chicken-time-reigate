import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profileRes, txnsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('loyalty_points').eq('id', user.id).single(),
    supabaseAdmin.from('loyalty_transactions').select('id, points, type, note, created_at, order_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
  ])

  const balance = profileRes.data?.loyalty_points ?? 0
  return NextResponse.json({ balance, transactions: txnsRes.data ?? [] })
}
