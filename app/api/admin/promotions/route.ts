import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { code, discount_type, discount_value, min_order_amount, is_active } = await request.json()

  if (!code?.trim()) return NextResponse.json({ error: 'Code is required' }, { status: 400 })
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
      code:             code.trim().toUpperCase(),
      discount_type,
      discount_value:   val,
      min_order_amount: parseFloat(min_order_amount ?? '0') || 0,
      is_active:        is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
