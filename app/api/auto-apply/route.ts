import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('id, code, discount_type, discount_value, min_order_amount')
    .eq('promo_type', 'AUTO_APPLY')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('discount_value', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promo: data ?? null })
}
