import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendOrderStatusEmail } from '@/lib/email'
import { checkStoreStatus, BusinessHours, Holiday, DayKey } from '@/lib/store-status'
import { validateScheduledFor } from '@/lib/utils/schedule-utils'
import { matchDeals, isDealLive, type Deal, type MenuItemLite } from '@/lib/deal-engine'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

interface Extra { name: string; price: number }

interface CartItem {
  menu_item_id?: string
  name:          string
  price:         number      // unit price already including extras
  quantity:      number
  totalPrice:    number      // price × quantity
  extras:        Extra[]
  removals:      string[]
  notes?:        string      // free-text only
}

// SQLSTATE codes raised by the redeem_reward RPC. Anything outside this map is
// an unexpected DB fault, not a rejected redemption, and is surfaced as a 500.
const REWARD_ERRORS: Record<string, string> = {
  LY001: 'Reward not found',
  LY002: 'Reward is no longer available',
  LY003: 'Reward is not available yet',
  LY004: 'Reward has expired',
  LY005: 'Your tier does not unlock this reward',
  LY006: 'Not enough points for this reward',
  LY007: 'Reward already redeemed',
  LY008: 'Reward is misconfigured — please contact us',
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

    // Parse body and fetch store settings concurrently
    const [bodyRaw, { data: storeSettings }] = await Promise.all([
      request.json() as Promise<{
        items: CartItem[]
        delivery_fee?: number
        postcode?: string
        promo_code?: string | null
        redeem_points?: number | null
        reward_promotion_id?: string | null
        customer_name?: string
        customer_phone?: string
        customer_email?: string
        delivery_address?: string
        delivery_postcode?: string
        customer_notes?: string | null
        order_type?: string
        scheduled_for?: string | null
      }>,
      supabaseAdmin
        .from('store_settings')
        .select('is_accepting_orders, business_hours, holidays')
        .eq('id', 1)
        .single(),
    ])

    const { items, delivery_fee = 0, postcode, promo_code, redeem_points, reward_promotion_id, customer_name, customer_phone, customer_email, delivery_address, delivery_postcode, customer_notes, order_type, scheduled_for } = bodyRaw

    // Store status guard
    if (storeSettings) {
      // Kill-switch always applies (scheduled orders included)
      if (!storeSettings.is_accepting_orders) {
        return NextResponse.json({ error: 'Store is not accepting orders' }, { status: 400 })
      }
      // ASAP orders: also check current hours + holidays
      // Scheduled orders: validated against their target day below
      if (!scheduled_for) {
        const status = checkStoreStatus(
          true,
          storeSettings.business_hours as BusinessHours | null,
          storeSettings.holidays as Holiday[] | null,
        )
        if (!status.isOpen) {
          const msg = ['Store is currently closed.', status.closedUntil].filter(Boolean).join(' ')
          return NextResponse.json({ error: msg }, { status: 400 })
        }
      }
    }

    // Validate scheduled time against actual DB hours for the target day
    if (scheduled_for) {
      const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
      if (!ISO_RE.test(scheduled_for)) {
        return NextResponse.json({ error: 'Invalid scheduled time format' }, { status: 400 })
      }
      const scheduledDate = new Date(scheduled_for)
      if (scheduledDate.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Cannot schedule more than 7 days in advance' }, { status: 400 })
      }
      // Holiday check for target date
      const scheduledDateStr = scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
      const holidays = storeSettings?.holidays as Holiday[] | null
      if (holidays?.some((h) => h.date === scheduledDateStr)) {
        return NextResponse.json({ error: 'Store is closed on that date (holiday)' }, { status: 400 })
      }
      const scheduledDay = scheduledDate.toLocaleDateString('en-US', {
        timeZone: 'Europe/London', weekday: 'long',
      }).toLowerCase() as DayKey
      const bh = storeSettings?.business_hours as BusinessHours | null
      const dayHours = bh?.[scheduledDay]
      // When business_hours configured, unconfigured/disabled days are closed
      if (bh && !dayHours?.enabled) {
        return NextResponse.json({ error: 'Store is closed on that day' }, { status: 400 })
      }
      const scheduleValidation = validateScheduledFor(
        scheduled_for,
        new Date(),
        dayHours?.open ?? '11:00',
        dayHours?.close ?? '22:00',
      )
      if (!scheduleValidation.valid) {
        return NextResponse.json({ error: scheduleValidation.error }, { status: 400 })
      }
    }
    // Availability guard: check items are still in stock.
    const itemIdsToCheck = items.map(i => i.menu_item_id).filter((id): id is string => Boolean(id))
    let dbItems: { id: string; name: string; is_available: boolean; sold_out_extras: string[] | null; price: number; category: string }[] = []
    if (itemIdsToCheck.length > 0) {
      const { data } = await supabaseAdmin
        .from('menu_items')
        .select('id, name, is_available, sold_out_extras, price, category')
        .in('id', itemIdsToCheck)
      dbItems = data ?? []
      const dbMap = new Map(dbItems.map(r => [r.id, r]))
      for (const item of items) {
        if (!item.menu_item_id) continue
        const db = dbMap.get(item.menu_item_id)
        if (!db) continue
        if (!db.is_available) {
          return NextResponse.json(
            { error: `Sorry, ${db.name} just sold out. Please remove it from your cart to continue.` },
            { status: 400 },
          )
        }
        const soldOutExtras: string[] = db.sold_out_extras ?? []
        if (soldOutExtras.length > 0) {
          const blockedExtra = item.extras.find(e => soldOutExtras.includes(e.name))
          if (blockedExtra) {
            return NextResponse.json(
              { error: `Sorry, ${blockedExtra.name} is no longer available as an extra on ${db.name}. Please update your order.` },
              { status: 400 },
            )
          }
        }
      }
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0)

    const { data: activeDeals } = await supabaseAdmin
      .from('deals')
      .select('id, type, name, config, is_active, available_from, available_until')
      .eq('is_active', true)

    const menuItemsById = new Map<string, MenuItemLite>(
      dbItems.map((m) => [m.id, { id: m.id, price: Number(m.price), category: m.category, is_available: m.is_available }]),
    )
    const { applied: appliedDeals, totalDiscount: rawDealsDiscountValue } = matchDeals(
      items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      (activeDeals ?? []).filter((d) => isDealLive(d)) as Deal[],
      menuItemsById,
    )
    // Cap deals savings at subtotal, same as the promo discount below — deals
    // and other discounts stack, so each individual source must be bounded
    // to avoid an unbounded combined discount driving the order total negative.
    const dealsDiscountValue = Math.min(rawDealsDiscountValue, subtotal)

    // A catalog reward is fully exclusive: it is the only discount source an
    // order may carry. Enforced here because the client can only hide the other
    // inputs, and because the deals engine applies itself from cart contents
    // with no request field to omit — a cart that already earns a bundle deal
    // is rejected rather than silently overridden, so a customer never spends
    // points on a reward that replaced a discount they were already getting.
    let rewardDiscountValue = 0
    let rewardFreeDelivery = false
    if (reward_promotion_id) {
      if (!userId) {
        return NextResponse.json({ error: 'Sign in to redeem a reward' }, { status: 401 })
      }
      if (promo_code) {
        return NextResponse.json(
          { error: 'A reward and a promo code cannot be used on the same order' },
          { status: 400 },
        )
      }
      if (redeem_points) {
        return NextResponse.json(
          { error: 'A reward and a points discount cannot be used on the same order' },
          { status: 400 },
        )
      }
      if (dealsDiscountValue > 0) {
        return NextResponse.json(
          { error: 'A bundle deal already applies to this cart — remove the reward or change your items' },
          { status: 400 },
        )
      }

      // Fast-fail read that also prices the benefit, because the total has to be
      // final before the order row and the Stripe coupon exist. The authoritative
      // charge is the redeem_reward RPC after the insert, which re-checks every
      // condition under a row lock. min_order_amount is checked only here — the
      // RPC reports it but does not enforce it, and points must not be spent on a
      // reward this cart cannot legally apply.
      const { data: reward } = await supabaseAdmin
        .from('promotions')
        .select('discount_type, discount_value, min_order_amount')
        .eq('id', reward_promotion_id)
        .eq('promo_type', 'REWARD')
        .maybeSingle()

      if (!reward) {
        return NextResponse.json({ error: REWARD_ERRORS.LY001 }, { status: 400 })
      }
      const minOrder = Number(reward.min_order_amount)
      if (subtotal < minOrder) {
        return NextResponse.json(
          { error: `This reward needs a minimum order of £${minOrder.toFixed(2)}` },
          { status: 400 },
        )
      }
      if (reward.discount_type === 'free_delivery') {
        rewardFreeDelivery = true
      } else if (reward.discount_type === 'percentage') {
        rewardDiscountValue = Math.round(subtotal * (Number(reward.discount_value) / 100) * 100) / 100
      } else if (reward.discount_type === 'flat') {
        rewardDiscountValue = Math.min(Number(reward.discount_value), subtotal)
      }
      // 'free_item' carries no discount — it adds a £0 line item instead (Task 6).
    }
    const effectiveDeliveryFee = rewardFreeDelivery ? 0 : delivery_fee

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

    // Loyalty points redemption. This read is a fast-fail only, so an
    // underfunded request doesn't leave a junk pending order behind — the
    // authoritative guard is the atomic debit further down, after the order row
    // exists and there is nothing left that can reject the request.
    let pointsDiscountValue = 0
    const pointsToRedeem = redeem_points && userId && redeem_points >= 100
      ? Math.floor(redeem_points / 100) * 100
      : 0
    if (pointsToRedeem > 0) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('loyalty_points')
        .eq('id', userId!)
        .single()
      const balance = profile?.loyalty_points ?? 0
      if (balance < pointsToRedeem) {
        return NextResponse.json({ error: 'Insufficient loyalty points' }, { status: 400 })
      }
      pointsDiscountValue = pointsToRedeem / 100
    }

    const totalDiscountForStripe = discountAmount + pointsDiscountValue + dealsDiscountValue + rewardDiscountValue
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

    const total = subtotal - discountAmount - pointsDiscountValue - dealsDiscountValue - rewardDiscountValue + effectiveDeliveryFee

    if (total < 0) {
      return NextResponse.json({ error: 'Discount total cannot exceed order subtotal' }, { status: 400 })
    }

    // Insert pending order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        status:              'pending',
        order_type:          order_type ?? 'delivery',
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
        scheduled_for:       scheduled_for ?? null,
        applied_deals:       appliedDeals.length > 0 ? appliedDeals : null,
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

    // Charge the reward after the order exists so one RPC transaction links the
    // point debit, the unlocked_rewards row and the order together — there is no
    // window where points are spent against an order id that never materialises.
    // A rejection here deletes the order instead (order_items cascade): an
    // abandoned order row is recoverable, silently spent points are not. Nothing
    // has been charged to the card at this point — the Stripe session is created
    // further down.
    if (reward_promotion_id && userId) {
      const { data: redeemed, error: rewardError } = await supabaseAdmin
        .rpc('redeem_reward', {
          p_uid:          userId,
          p_promotion_id: reward_promotion_id,
          p_order_id:     order.id,
        })

      if (rewardError) {
        await supabaseAdmin.from('orders').delete().eq('id', order.id)
        const message = REWARD_ERRORS[rewardError.code]
        if (!message) {
          console.error('Reward redemption error:', rewardError)
          return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
        }
        return NextResponse.json({ error: message }, { status: 400 })
      }

      const reward = redeemed as { discount_type: string; reward_config: { menu_item_id?: string } }
      if (reward.discount_type === 'free_item') {
        // TODO(Task 6): insert the £0 order_items row for
        // reward.reward_config.menu_item_id against order.id here.
      }
    }

    // Loyalty: redeem, then earn
    if (userId) {
      const pointsEarned = Math.floor(subtotal * 10)
      if (pointsToRedeem > 0) {
        // The balance condition lives inside the UPDATE, so two concurrent
        // checkouts can't both spend the same points. Null means the balance no
        // longer covers it — reject rather than let the discount through free.
        const { data: newBalance, error: redeemError } = await supabaseAdmin
          .rpc('redeem_loyalty_points', { uid: userId, cost: pointsToRedeem })
        if (redeemError) {
          console.error('Loyalty redemption error:', redeemError)
          return NextResponse.json({ error: 'Failed to redeem loyalty points' }, { status: 500 })
        }
        if (newBalance === null) {
          return NextResponse.json({ error: 'Insufficient loyalty points' }, { status: 400 })
        }
        supabaseAdmin.from('loyalty_transactions').insert({
          user_id: userId, order_id: order.id, points: -pointsToRedeem, type: 'redeem', note: 'Redeemed at checkout',
        })
      }
      if (pointsEarned > 0) {
        supabaseAdmin.rpc('adjust_loyalty', { uid: userId, delta: pointsEarned })
        supabaseAdmin.from('loyalty_transactions').insert({
          user_id: userId, order_id: order.id, points: pointsEarned, type: 'earn', note: 'Earned from order',
        })
      }
      if (pointsEarned > 0 || pointsToRedeem > 0) {
        supabaseAdmin.from('orders').update({
          points_earned: pointsEarned, points_redeemed: pointsToRedeem,
        }).eq('id', order.id)
      }
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

    if (effectiveDeliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(effectiveDeliveryFee * 100),
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
      success_url: `${origin}/track/${order.id}`,
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
