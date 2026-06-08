import { ReactNode } from 'react'
import { getUserPermissions } from '@/lib/get-user-permissions'
import PermissionsProvider from '@/components/admin/permissions-provider'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  return (
    <PermissionsProvider email={perms?.email ?? ''} permissions={perms?.permissions ?? []} isOwner={perms?.isOwner ?? false}>
      <div className="pl-60 min-h-screen bg-zinc-950">
        {children}
      </div>
    </PermissionsProvider>
  )
}
