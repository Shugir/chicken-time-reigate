'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/SiteHeader'
import { StoreStatusBanner } from '@/components/StoreStatusBanner'
import { Footer } from '@/components/Footer'

const BACK_OFFICE_PREFIXES = ['/admin', '/kitchen', '/driver']

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBackOffice = BACK_OFFICE_PREFIXES.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`),
  )

  if (isBackOffice) {
    return <main className="flex-1 min-h-[60vh]">{children}</main>
  }

  return (
    <>
      <StoreStatusBanner />
      <SiteHeader />
      <main className="flex-1 min-h-[60vh]">{children}</main>
      <Footer />
    </>
  )
}
