import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendOrderStatusEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

interface Extra { name: string; price: number }

interface CartItem {
  name: string
  price: number      // unit price already including extras
  quantity: number
  totalPrice: number // price × quantity
  extras:   Extra[]
  removals: string[]
  notes?: string     // free-text only
}

export async function POST(request: NextRequest) {
  try {
    // Detect logged-in user to link order to their account
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      },
    )
    const { data: { user: authUser } } = await supabaseClient.auth.getUser()
    const userId = authUser?.id ?? null

    const { items, delivery_fee = 0, postcode, promo_code, redeem_points, customer_name, customer_phone, customer_email, delivery_address, delivery_postcode, customer_notes }: {
      items: CartItem[]
      delivery_fee?: number
      postcode?: string
      promo_code?: string | null
      redeem_points?: number | null
      customer_name?: string
      customer_phone?: string
      customer_email?: string
      delivery_address?: string
      delivery_postcode?: string
      customer_notes?: string | null
    } = await request.json()
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)

    let discountAmount = 0
    if (promo_code) {
      const { data: promo } = await supabaseAdmin
        .from('promotions')
        .select('*')
        .eq('code', promo_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle()

      if (promo && (Number(promo.min_order_amount) <= 0 || subtotal >= Number(promo.min_order_amount))) {
        discountAmount = promo.discount_type === 'percentage'
          ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
          : Math.min(Number(promo.discount_value), subtotal)
      }
    }

    // Loyalty points redemption: 100 pts = £1, must be multiple of 100
    let pointsDiscountValue = 0
    const pointsToRedeem = redeem_points && userId && redeem_points >= 100
      ? Math.floor(redeem_points / 100) * 100
      : 0
    if (pointsToRedeem > 0) {
      const { data: txns } = await supabaseAdmin
        .from('loyalty_transactions')
        .select('points')
        .eq('user_id', userId!)
      const balance = (txns ?? []).reduce((sum, t) => sum + t.points, 0)
      if (balance < pointsToRedeem) {
        return NextResponse.json({ error: 'Insufficient loyalty points' }, { status: 400 })
      }
      pointsDiscountValue = pointsToRedeem / 100
    }

    const totalDiscountForStripe = discountAmount + pointsDiscountValue
    let stripeCouponId: string | undefined
    if (totalDiscountForStripe > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(totalDiscountForStripe * 100),
        currency:   'gbp',
        duration:   'once',
        name:       [promo_code?.trim().toUpperCase(), pointsToRedeem ? `${pointsToRedeem}pts` : ''].filter(Boolean).join('+') || 'Discount',
      })
      stripeCouponId = coupon.id
    }

    const total = subtotal - discountAmount - pointsDiscountValue + delivery_fee

    // Insert pending order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        status:              'pending',
        total_amount:        total,
        user_id:             userId,
        customer_name:       customer_name       ?? null,
        customer_phone:      customer_phone      ?? null,
        delivery_address:    delivery_address    ?? null,
        delivery_postcode:   delivery_postcode   ?? postcode ?? null,
        customer_notes:      customer_notes      ?? null,
        customer_email:      customer_email      ?? authUser?.email ?? null,
        promo_code_used:     discountAmount > 0 ? (promo_code?.trim().toUpperCase() ?? null) : null,
        discount_applied:    discountAmount,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('Supabase order insert error:', orderError)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Insert order items with structured extras/removals
    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(
        items.map((item) => ({
          order_id:   order.id,
          item_name:  item.name,
          quantity:   item.quantity,
          unit_price: item.price,
          extras:     item.extras   ?? [],
          removals:   item.removals ?? [],
          notes:      item.notes    ?? null,
        })),
      )

    if (itemsError) {
      console.error('Supabase order_items insert error:', itemsError)
      return NextResponse.json({ error: 'Failed to save order items' }, { status: 500 })
    }

    // Record loyalty points redemption (non-blocking)
    if (pointsToRedeem > 0 && userId) {
      supabaseAdmin.from('loyalty_transactions').insert({
        user_id:  userId,
        order_id: order.id,
        points:   -pointsToRedeem,
        type:     'redeem',
        note:     `Redeemed at checkout`,
      })
    }

    // Create Stripe checkout session
    // unit_amount = (base price + extras) × 100 — `item.price` already includes extras
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name,
          ...(item.extras.length > 0 && {
            description: item.extras.map((e) => `+ ${e.name}`).join(', '),
          }),
        },
      },
      quantity: item.quantity,
    }))

    if (delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(delivery_fee * 100),
          product_data: { name: 'Delivery' },
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      ...(stripeCouponId && { discounts: [{ coupon: stripeCouponId }] }),
      metadata: { orderId: order.id, ...(postcode && { postcode }), ...(promo_code && { promo_code }) },
      success_url: `${origin}/order?success=true`,
      cancel_url:  `${origin}/order?canceled=true`,
    })

    // Store Stripe session ID for reconciliation
    await supabaseAdmin
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)

    // Fire "Order Received" email (non-blocking, guest orders silently skipped)
    sendOrderStatusEmail(
      {
        id:               order.id,
        customer_name:    customer_name    ?? null,
        total_amount:     total,
        delivery_address: delivery_address ?? null,
        items:            items.map((i) => ({ name: i.name, quantity: i.quantity })),
      },
      'received',
      authUser?.email ?? null,
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
