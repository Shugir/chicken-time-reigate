import { ReactNode } from 'react'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import AccessDenied from '@/components/admin/access-denied'
import PermissionsProvider from '@/components/admin/permissions-provider'

export default async function KitchenLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Kitchen')) {
    return <AccessDenied back="/admin/dashboard" />
  }
  return (
    <PermissionsProvider email={perms.email} permissions={perms.permissions} isOwner={perms.isOwner}>
      {children}
    </PermissionsProvider>
  )
}
