import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const { delta, note } = await request.json()

  if (typeof delta !== 'number' || delta === 0) {
    return NextResponse.json({ error: 'delta must be a non-zero number' }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('loyalty_points')
    .eq('id', userId)
    .maybeSingle()

  const current = profile?.loyalty_points ?? 0
  const next = Math.max(0, current + delta)

  await supabaseAdmin.from('profiles').upsert({ id: userId, loyalty_points: next })

  const type = delta > 0 ? 'admin_credit' : 'admin_debit'
  await supabaseAdmin.from('loyalty_transactions').insert({
    user_id: userId, points: delta, type, note: note ?? null,
  })

  return NextResponse.json({ ok: true, balance: next })
}
