import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase-admin'

export interface UserPermissions {
  email:       string
  role:        'owner' | 'staff'
  permissions: string[]
  isOwner:     boolean
}

// Deduplicates across server component tree within the same request
export const getUserPermissions = cache(async (): Promise<UserPermissions | null> => {
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
  if (!user?.email) return null

  const { data: record } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email)
    .maybeSingle()

  // Customers are signed-in users with no staff row, so absence must deny.
  // Owners are granted by an explicit role: 'owner' row, never by default.
  if (!record) return null

  return {
    email:       user.email,
    role:        record.role as 'owner' | 'staff',
    permissions: (record.permissions as string[]) ?? [],
    isOwner:     record.role === 'owner',
  }
})

export function hasPermission(userPerms: UserPermissions, permission: string): boolean {
  if (userPerms.isOwner) return true
  return userPerms.permissions.includes(permission)
}
