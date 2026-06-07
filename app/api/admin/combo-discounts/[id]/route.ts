import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if ('name' in body)            update.name            = String(body.name).trim()
  if ('discount_amount' in body) update.discount_amount = parseFloat(body.discount_amount)
  if ('is_active' in body)       update.is_active       = Boolean(body.is_active)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  if ('discount_amount' in update && isNaN(update.discount_amount as number)) {
    return NextResponse.json({ error: 'discount_amount must be a number' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('combo_discounts')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
