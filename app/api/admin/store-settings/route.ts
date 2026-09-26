import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

// Deliberately public: the site header and sign-in page read opening hours and
// the open/closed flag before anyone has signed in.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Every column app/admin/settings/page.tsx saves. Anything else (id, future columns)
// can't be written through this route.
const EDITABLE = new Set([
  'is_accepting_orders', 'is_open', 'prep_time_minutes',
  'contact_email', 'contact_phone', 'store_address',
  'email_sender_name', 'email_sender_address',
  'business_hours', 'holidays', 'logo_url',
  'show_vat', 'vat_rate',
])

export async function PATCH(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'StoreSettings')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const keys = Object.keys(body)
  if (keys.length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  const unknown = keys.find((k) => !EDITABLE.has(k))
  if (unknown) return NextResponse.json({ error: `Unknown setting: ${unknown}` }, { status: 400 })

  const badShowVat = 'show_vat' in body && typeof body.show_vat !== 'boolean'
  const badVatRate = 'vat_rate' in body &&
    !(typeof body.vat_rate === 'number' && Number.isFinite(body.vat_rate) && body.vat_rate >= 0 && body.vat_rate <= 100)
  if (badShowVat || badVatRate) {
    return NextResponse.json({ error: 'Invalid VAT setting' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
