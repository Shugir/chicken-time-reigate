'use client'

import { useEffect, useRef, useState } from 'react'
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
  const closeRef = useRef<HTMLButtonElement>(null)

  // Phone drawer: Escape closes it, focus moves into it, and the page behind stops scrolling
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  function isActive(href: string) {
    // '/admin' and '/admin/loyalty' are prefixes of other nav entries, so they
    // only light up on an exact match (plus the menu item editor pages for '/admin').
    if (href === '/admin' && pathname.startsWith('/admin/menu/')) return true
    return href === '/admin' || href === '/admin/loyalty'
      ? pathname === href
      : pathname.startsWith(href)
  }

  const current = NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i.href))?.label ?? 'Admin'

  return (
    <>
      {/* Phone/tablet top bar (the admin layout pads content by its height, pt-14) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-3 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/60">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="admin-nav"
          className="h-11 px-3 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
        >
          <Menu size={18} aria-hidden="true" />
          Menu
        </button>
        <p className="min-w-0 truncate text-sm font-bold text-white">{current}</p>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

    {/* Closed on phones it is also invisible, so keyboard focus never lands on off-screen links.
        Visibility flips at once on open (so the close button can take focus) and after the slide on close. */}
    <aside
      id="admin-nav"
      aria-label="Admin navigation"
      className={`w-60 max-w-[85vw] fixed left-0 top-0 h-full bg-zinc-950 border-r border-zinc-800/60 flex flex-col overflow-y-auto overscroll-contain z-50 duration-300 ease-in-out [scrollbar-width:thin] [scrollbar-color:var(--color-zinc-700)_transparent] ${open ? 'transition-[translate] translate-x-0 visible' : 'transition-[translate,visibility] -translate-x-full invisible'} md:translate-x-0 md:visible`}
    >
      {/* Mobile close button */}
      <button
        ref={closeRef}
        onClick={() => setOpen(false)}
        aria-label="Close navigation"
        className="md:hidden absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
      >
        <X size={18} />
      </button>

      {/* Brand */}
      <div className="shrink-0 px-5 py-5 border-b border-zinc-800/60">
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
      <nav className="grow shrink-0 px-3 py-4 space-y-5">
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
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
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
      <div className="shrink-0 px-3 pb-2 border-t border-zinc-800/60 pt-3">
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
      <div className="shrink-0 px-4 py-4 border-t border-zinc-800/60 space-y-2">
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
