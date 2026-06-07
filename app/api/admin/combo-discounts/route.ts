import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .select('*')
    .order('meal_size')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { meal_size, name, discount_amount, is_active = true } = await request.json()

  if (!meal_size || !['medium', 'large'].includes(meal_size)) {
    return NextResponse.json({ error: 'meal_size must be medium or large' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const amount = parseFloat(discount_amount)
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: 'discount_amount must be a non-negative number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .insert({ meal_size, name: name.trim(), discount_amount: amount, is_active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
