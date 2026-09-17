import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Both the drivers screen and the users screen pick accounts from this list.
  const perms = await getUserPermissions()
  if (!perms || !(hasPermission(perms, 'Fleet') || hasPermission(perms, 'UserControl'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let users = (data.users ?? []).map((u) => ({ id: u.id, email: u.email ?? '' }))
  if (q) users = users.filter((u) => u.email.toLowerCase().includes(q))

  return NextResponse.json(users)
}
