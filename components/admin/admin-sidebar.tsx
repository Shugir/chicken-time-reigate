'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, Settings, MapPin, Tag,
  Truck, Shield, ExternalLink, Layers, TrendingUp, Users, Star,
} from 'lucide-react'
import SignOutButton from './sign-out-button'
import { usePermissions } from './permissions-provider'

const ALL_NAV = [
  { id: 'dashboard',  label: 'Dashboard',       icon: LayoutDashboard, href: '/admin/dashboard',  permission: 'Dashboard'     },
  { id: 'analytics',  label: 'Analytics',       icon: TrendingUp,      href: '/admin/analytics',  permission: 'Analytics'     },
  { id: 'menu',       label: 'Menu Manager',    icon: UtensilsCrossed, href: '/admin',               permission: 'MenuManager'   },
  { id: 'categories', label: 'Categories',      icon: Layers,          href: '/admin/categories',  permission: 'Categories'    },
  { id: 'combos',     label: 'Combos',          icon: Layers,          href: '/admin/combos',      permission: 'MenuManager'   },
  { id: 'settings',   label: 'Store Settings',  icon: Settings,        href: '/admin/settings',    permission: 'StoreSettings' },
  { id: 'delivery',   label: 'Delivery Zones',  icon: MapPin,          href: '/admin/delivery',   permission: 'DeliveryZones' },
  { id: 'promotions', label: 'Promotions',       icon: Tag,             href: '/admin/promotions', permission: 'Promotions'    },
  { id: 'drivers',    label: 'Fleet & Drivers',  icon: Truck,           href: '/admin/drivers',    permission: 'Fleet'         },
  { id: 'staff',      label: 'User Control',     icon: Shield,          href: '/admin/staff',      permission: 'UserControl'   },
  { id: 'users',      label: 'Auth Users',       icon: Users,           href: '/admin/users',      permission: 'UserControl'   },
  { id: 'loyalty',    label: 'Loyalty Points',   icon: Star,            href: '/admin/loyalty',    permission: 'Loyalty'       },
]

export default function AdminSidebar() {
  const pathname           = usePathname()
  const { can, email }     = usePermissions()

  const visibleNav = ALL_NAV.filter((item) => can(item.permission))

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Image src="/Logo_v3-removebg-preview.png" alt="Chicken Time" width={40} height={40} className="w-10 h-10 object-contain" />
          <div>
            <p className="text-xs font-bold text-white leading-tight">Chicken Time</p>
            <p className="text-[10px] text-zinc-500 leading-tight">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const Icon     = item.icon
          // /admin active only for exact match to avoid highlighting it for all sub-routes
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-brand-red/15 text-white ring-1 ring-brand-red/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pt-2 pb-1 border-t border-zinc-800">
        <a
          href="/kitchen"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Kitchen Display
          <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
        </a>
      </div>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-2">
        {email && (
          <div className="px-3 py-2 rounded-lg bg-zinc-800/50">
            <p className="text-[11px] text-zinc-500 leading-tight">Signed in as</p>
            <p className="text-xs text-zinc-300 font-medium truncate leading-tight mt-0.5">{email}</p>
          </div>
        )}
        <SignOutButton />
        <p className="text-[11px] text-zinc-600 px-3">v1.0 · Reigate</p>
      </div>
    </aside>
  )
}
