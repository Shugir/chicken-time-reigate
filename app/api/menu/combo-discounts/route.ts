import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const size = request.nextUrl.searchParams.get('size')
  if (!size || !['medium', 'large'].includes(size)) {
    return NextResponse.json({ error: 'size must be medium or large' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .select('id, meal_size, name, discount_amount')
    .eq('meal_size', size)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to fetch discount' }, { status: 500 })
  return NextResponse.json(data ?? null)
}
