import { redirect } from 'next/navigation'
import { getUserPermissions } from '@/lib/get-user-permissions'

const PAGES = [
  { permission: 'Dashboard',          href: '/admin/dashboard'  },
  { permission: 'MenuManager',        href: '/admin'            },
  { permission: 'StoreSettings',      href: '/admin/settings'   },
  { permission: 'DeliveryZones',      href: '/admin/delivery'   },
  { permission: 'Promotions',         href: '/admin/promotions' },
  { permission: 'Fleet',              href: '/admin/drivers'    },
  { permission: 'UserControl',        href: '/admin/staff'      },
  { permission: 'Kitchen',            href: '/kitchen'          },
]

export default async function AdminRedirectPage() {
  const perms = await getUserPermissions()

  if (!perms) redirect('/sign-in')

  if (perms.isOwner) redirect('/admin/dashboard')

  const first = PAGES.find((p) => perms.permissions.includes(p.permission))
  if (first) redirect(first.href)

  redirect('/sign-in')
}
