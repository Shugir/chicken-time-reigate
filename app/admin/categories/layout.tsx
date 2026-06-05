import { ReactNode } from 'react'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'
import AccessDenied from '@/components/admin/access-denied'

export default async function CategoriesLayout({ children }: { children: ReactNode }) {
  const perms = await getUserPermissions()
  if (!perms || !hasPermission(perms, 'Categories')) return <AccessDenied />
  return <>{children}</>
}
