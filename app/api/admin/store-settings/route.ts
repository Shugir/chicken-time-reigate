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

export async function PATCH(request: NextRequest) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'StoreSettings')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
