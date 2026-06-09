import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
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
  const { code, promo_type, discount_type, discount_value, min_order_amount, points_cost, start_date, end_date, is_active } = await request.json()

  if (promo_type === 'VOUCHER' && !code?.trim()) {
    return NextResponse.json({ error: 'Code is required for VOUCHER type' }, { status: 400 })
  }
  if (!['flat', 'percentage'].includes(discount_type))
    return NextResponse.json({ error: 'discount_type must be flat or percentage' }, { status: 400 })
  const val = parseFloat(discount_value)
  if (isNaN(val) || val <= 0)
    return NextResponse.json({ error: 'discount_value must be a positive number' }, { status: 400 })
  if (discount_type === 'percentage' && val > 100)
    return NextResponse.json({ error: 'Percentage discount cannot exceed 100' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .insert({
      code:             code?.trim().toUpperCase() ?? null,
      promo_type:       promo_type       ?? 'VOUCHER',
      points_cost:      points_cost      ?? null,
      discount_type,
      discount_value:   val,
      min_order_amount: parseFloat(min_order_amount ?? '0') || 0,
      is_active:        is_active ?? true,
      start_date:       start_date ?? null,
      end_date:         end_date   ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
