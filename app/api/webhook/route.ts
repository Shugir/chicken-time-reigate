import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook Error: ${message}`)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.orderId

    if (orderId) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', orderId)
        .eq('status', 'pending')

      // Earn loyalty points: 10 pts per £1 of order total
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('user_id, total_amount')
        .eq('id', orderId)
        .single()

      if (order?.user_id) {
        const earned = Math.floor(Number(order.total_amount) * 10)
        if (earned > 0) {
          await supabaseAdmin.from('loyalty_transactions').insert({
            user_id:  order.user_id,
            order_id: orderId,
            points:   earned,
            type:     'earn',
            note:     `Earned from order ${orderId.slice(0, 8)}`,
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
