'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, Settings, MapPin, Tag,
  Truck, Shield, ExternalLink, Layers, TrendingUp, Users, Star, Trophy, Radio, ReceiptText,
  Menu, X,
} from 'lucide-react'
import SignOutButton from './sign-out-button'
import { usePermissions } from './permissions-provider'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, href: '/admin/dashboard',  permission: 'Dashboard'     },
      { id: 'analytics',  label: 'Analytics',      icon: TrendingUp,      href: '/admin/analytics',  permission: 'Analytics'     },
    ],
  },
  {
    label: 'Menu',
    items: [
      { id: 'menu',       label: 'Menu Manager',   icon: UtensilsCrossed, href: '/admin',            permission: 'MenuManager'   },
      { id: 'categories', label: 'Categories',     icon: Layers,          href: '/admin/categories', permission: 'Categories'    },
      { id: 'deals',      label: 'Deals',          icon: Tag,             href: '/admin/deals',      permission: 'Deals'         },
      { id: 'promotions', label: 'Promotions',     icon: Tag,             href: '/admin/promotions', permission: 'Promotions'    },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'dispatch',   label: 'Live Dispatch',   icon: Radio,           href: '/admin/dispatch',  permission: 'Fleet'         },
      { id: 'drivers',    label: 'Fleet & Drivers', icon: Truck,           href: '/admin/drivers',   permission: 'Fleet'         },
      { id: 'receipts',   label: 'Receipts',        icon: ReceiptText,     href: '/admin/receipts',  permission: 'Receipts'      },
      { id: 'delivery',   label: 'Delivery Zones',  icon: MapPin,          href: '/admin/delivery',  permission: 'DeliveryZones' },
    ],
  },
  {
    label: 'Access',
    items: [
      { id: 'staff',      label: 'User Control',    icon: Shield,          href: '/admin/staff',     permission: 'UserControl'   },
      { id: 'users',      label: 'Auth Users',      icon: Users,           href: '/admin/users',     permission: 'UserControl'   },
      { id: 'loyalty',    label: 'Loyalty Points',  icon: Star,            href: '/admin/loyalty',   permission: 'Loyalty'       },
      { id: 'tiers',      label: 'Loyalty Tiers',   icon: Trophy,          href: '/admin/loyalty/tiers', permission: 'Loyalty'  },
      { id: 'settings',   label: 'Store Settings',  icon: Settings,        href: '/admin/settings',  permission: 'StoreSettings' },
    ],
  },
]

export default function AdminSidebar() {
  const pathname       = usePathname()
  const { can, email } = usePermissions()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    // '/admin' and '/admin/loyalty' are prefixes of other nav entries, so they
    // only light up on an exact match (plus the menu item editor pages for '/admin').
    if (href === '/admin' && pathname.startsWith('/admin/menu/')) return true
    return href === '/admin' || href === '/admin/loyalty'
      ? pathname === href
      : pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile FAB — open sidebar */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed bottom-6 left-4 z-50 md:hidden w-12 h-12 rounded-full bg-brand-red shadow-lg shadow-red-900/50 flex items-center justify-center"
      >
        <Menu size={22} className="text-white" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

    <aside className={`w-60 fixed left-0 top-0 h-full bg-zinc-950 border-r border-zinc-800/60 flex flex-col overflow-y-auto z-40 transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      {/* Mobile close button */}
      <button
        onClick={() => setOpen(false)}
        aria-label="Close navigation"
        className="md:hidden absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
      >
        <X size={18} />
      </button>

      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-red flex items-center justify-center shrink-0 shadow-lg shadow-red-900/40">
            <Image src="/Logo_v3-removebg-preview.png" alt="Chicken Time" width={28} height={28} className="w-7 h-7 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Chicken Time</p>
            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter((item) => can(item.permission))
          if (visible.length === 0) return null
          return (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.12em] px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const Icon   = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`w-full flex items-center gap-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? 'bg-brand-red/10 text-white border-l-[3px] border-brand-red rounded-r-xl pl-[9px] pr-3'
                          : 'rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 border-l-[3px] border-transparent pl-[9px] pr-3'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brand-red' : ''}`} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Kitchen link */}
      <div className="px-3 pb-2 border-t border-zinc-800/60 pt-3">
        <a
          href="/kitchen"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Kitchen Display
          <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
        </a>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800/60 space-y-2">
        {email && (
          <div className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800/60">
            <p className="text-[10px] text-zinc-600 leading-tight">Signed in as</p>
            <p className="text-xs text-zinc-300 font-medium truncate leading-tight mt-0.5">{email}</p>
          </div>
        )}
        <SignOutButton />
        <p className="text-[10px] text-zinc-700 px-3">v1.0 · Reigate</p>
      </div>
    </aside>
    </>
  )
}
