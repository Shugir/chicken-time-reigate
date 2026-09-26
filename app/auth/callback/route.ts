import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { safeNextPath } from '@/lib/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const { data: staffRecord } = await supabaseAdmin
          .from('staff_permissions')
          .select('role')
          .eq('email', user.email)
          .maybeSingle()

        if (staffRecord) {
          return NextResponse.redirect(`${origin}/admin/redirect`)
        }
      }

      // Customers may return where they signed in from (e.g. the customizer); staff keep their redirect
      return NextResponse.redirect(`${origin}${safeNextPath(searchParams.get('next')) ?? '/account'}`)
    }
  }

  // Back to sign-in with an error flag, keeping where the customer was heading
  const failed = new URL('/sign-in', origin)
  failed.searchParams.set('error', 'oauth')
  const next = safeNextPath(searchParams.get('next'))
  if (next) failed.searchParams.set('next', next)
  return NextResponse.redirect(failed)
}
