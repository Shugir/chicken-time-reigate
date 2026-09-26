import { ReactNode } from 'react'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import AccessDenied from '@/components/admin/access-denied'

// Deals list and the add/edit pages need the Deals permission (the API checks it too)
export default async function DealsLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Deals')) return <AccessDenied />
  return <>{children}</>
}
