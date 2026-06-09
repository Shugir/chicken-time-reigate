import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateReceiptBuffer, sendToPrinter } from '@/lib/printer'

export const dynamic = 'force-dynamic'

const ORDER_FIELDS = `
  id, order_type, customer_name, customer_phone, customer_notes,
  delivery_address, delivery_postcode, total_amount, created_at, driver_id,
  order_items(id, item_name, quantity, unit_price, extras, removals, notes)
`

export async function POST(req: NextRequest) {
  // 1. Auth check
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 2. Get order details
  const { orderId, printerIp = 'localhost' } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Get driver name if assigned
  let driverName = ''
  if (order.driver_id) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('name')
      .eq('id', order.driver_id)
      .single()
    driverName = driver?.name ?? ''
  }

  try {
    // 3. Generate ESC/POS buffer
    const buffer = generateReceiptBuffer(order, driverName)

    // 4. Send to printer (troubleshoot with localhost/escpresso)
    await sendToPrinter(buffer, printerIp, 9100)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Print error:', err)
    return NextResponse.json({ 
      error: 'Printer unreachable. Ensure escpresso is running on ' + printerIp + ':9100',
      details: err.message 
    }, { status: 502 })
  }
}
