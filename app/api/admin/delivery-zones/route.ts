import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('delivery_zones')
    .select('*')
    .order('postcode_prefix', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { postcode_prefix, delivery_fee, min_order_amount, is_active } = await request.json()

  if (!postcode_prefix) return NextResponse.json({ error: 'postcode_prefix is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('delivery_zones')
    .insert({
      postcode_prefix: postcode_prefix.trim().toUpperCase(),
      delivery_fee:      delivery_fee      ?? 1.99,
      min_order_amount:  min_order_amount  ?? 0,
      is_active:         is_active         ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
