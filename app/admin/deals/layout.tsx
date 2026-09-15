import { ReactNode } from 'react'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import AccessDenied from '@/components/admin/access-denied'

export default async function DealsLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Deals')) return <AccessDenied />
  return <>{children}</>
}
