import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must have Driver permission in staff_permissions
  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()

  const hasDriverPerm = perms?.role === 'owner' || (perms?.permissions ?? []).includes('Driver')
  if (!hasDriverPerm) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, customer_name, customer_phone, delivery_address, delivery_postcode, customer_notes, total_amount, created_at')
    .eq('delivery_status', 'out_for_delivery')
    .eq('driver_id', driver.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [], driver_id: driver.id })
}
