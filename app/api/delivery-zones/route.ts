import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get('postcode') ?? ''
  const normalized = postcode.trim().toUpperCase()

  const { data: zones, error } = await supabaseAdmin
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .order('postcode_prefix', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const match = (zones ?? []).find((z) =>
    normalized.startsWith(z.postcode_prefix.toUpperCase()),
  )

  return NextResponse.json({ zone: match ?? null })
}
