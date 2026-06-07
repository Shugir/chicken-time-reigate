import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [{ data: txns, error }, { data: usersData }] = await Promise.all([
    supabaseAdmin.from('loyalty_transactions').select('user_id, points'),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const emailMap = new Map<string, string>()
  for (const u of usersData?.users ?? []) emailMap.set(u.id, u.email ?? '')

  const balanceMap = new Map<string, number>()
  for (const t of txns ?? []) {
    balanceMap.set(t.user_id, (balanceMap.get(t.user_id) ?? 0) + t.points)
  }

  const leaderboard = Array.from(balanceMap.entries())
    .map(([user_id, balance]) => ({ user_id, email: emailMap.get(user_id) ?? '—', balance }))
    .sort((a, b) => b.balance - a.balance)

  return NextResponse.json(leaderboard)
}

export async function POST(request: NextRequest) {
  const { user_id, points, type, note } = await request.json()

  if (!user_id || typeof points !== 'number' || !['admin_credit', 'admin_debit'].includes(type)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const signedPoints = type === 'admin_debit' ? -Math.abs(points) : Math.abs(points)

  const { error } = await supabaseAdmin.from('loyalty_transactions').insert({
    user_id,
    points: signedPoints,
    type,
    note: note ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
