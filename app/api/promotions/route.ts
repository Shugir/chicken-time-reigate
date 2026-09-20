import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { promoWindowError } from '@/lib/reward-checkout'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code        = searchParams.get('code')
  const subtotalStr = searchParams.get('subtotal')

  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const subtotal = subtotalStr ? parseFloat(subtotalStr) : 0

  const { data: promo, error } = await supabaseAdmin
    .from('promotions')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .eq('promo_type', 'VOUCHER')
    .maybeSingle()

  if (error)  return NextResponse.json({ error: error.message }, { status: 500 })
  if (!promo) return NextResponse.json({ error: 'Invalid or inactive promo code' }, { status: 404 })

  const windowError = promoWindowError(promo)
  if (windowError) return NextResponse.json({ error: windowError }, { status: 422 })

  if (Number(promo.min_order_amount) > 0 && subtotal < Number(promo.min_order_amount)) {
    return NextResponse.json(
      { error: `Minimum order £${Number(promo.min_order_amount).toFixed(2)} required for this code (you have £${subtotal.toFixed(2)})` },
      { status: 422 },
    )
  }

  let discountAmount: number
  if (promo.discount_type === 'percentage') {
    discountAmount = Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
  } else {
    discountAmount = Math.min(Number(promo.discount_value), subtotal)
  }

  return NextResponse.json({
    code:            promo.code,
    discount_type:   promo.discount_type,
    discount_value:  promo.discount_value,
    discount_amount: discountAmount,
  })
}
