import { ReactNode } from 'react'
import { getUserPermissions } from '@/lib/get-user-permissions'
import PermissionsProvider from '@/components/admin/permissions-provider'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  return (
    <PermissionsProvider permissions={perms?.permissions ?? []} isOwner={perms?.isOwner ?? false}>
      {children}
    </PermissionsProvider>
  )
}
