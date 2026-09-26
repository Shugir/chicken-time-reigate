import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkStoreStatus, BusinessHours, Holiday } from '@/lib/store-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .select('is_open, prep_time_minutes, is_accepting_orders, contact_email, contact_phone, store_address, business_hours, holidays, show_vat, vat_rate')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const status = checkStoreStatus(
    data.is_accepting_orders ?? true,
    data.business_hours as BusinessHours | null,
    data.holidays as Holiday[] | null,
  )

  return NextResponse.json({
    ...data,
    is_open:         status.isOpen,   // override raw is_open with computed value
    isCurrentlyOpen: status.isOpen,
    closedUntil:     status.closedUntil,
    closedReason:    status.reason,
  })
}
