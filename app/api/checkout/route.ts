import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

interface CartItem {
  name: string
  quantity: number
  totalPrice: number
}

export async function POST(request: NextRequest) {
  const { items }: { items: CartItem[] } = await request.json()
  const origin = request.headers.get('origin') ?? ''

  const total = items.reduce((sum, i) => sum + i.totalPrice, 0)

  // Insert pending order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({ status: 'pending', total_amount: total })
    .select('id')
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // Insert order items
  const { error: itemsError } = await supabaseAdmin
    .from('order_items')
    .insert(
      items.map((item) => ({
        order_id:   order.id,
        item_name:  item.name,
        quantity:   item.quantity,
        unit_price: item.totalPrice / item.quantity,
      })),
    )

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to save order items' }, { status: 500 })
  }

  // Create Stripe checkout session with orderId in metadata
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((item) => ({
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round((item.totalPrice / item.quantity) * 100),
        product_data: { name: item.name },
      },
      quantity: item.quantity,
    })),
    metadata: { orderId: order.id },
    success_url: `${origin}/order?success=true`,
    cancel_url:  `${origin}/order?canceled=true`,
  })

  // Store Stripe session ID for reconciliation
  await supabaseAdmin
    .from('orders')
    .update({ stripe_session_id: session.id })
    .eq('id', order.id)

  return NextResponse.json({ url: session.url })
}
