import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // 1. Anonymise personal data on orders before unlinking
  await supabaseAdmin
    .from('orders')
    .update({
      customer_name:     null,
      customer_phone:    null,
      customer_notes:    null,
      delivery_address:  null,
      delivery_postcode: null,
    })
    .eq('user_id', user.id)

  // 2. Nullify user_id (avoids FK RESTRICT violation when deleting the auth user)
  await supabaseAdmin
    .from('orders')
    .update({ user_id: null })
    .eq('user_id', user.id)

  // 3. Delete auth user — CASCADE deletes the profiles row
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
