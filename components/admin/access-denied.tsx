import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function AccessDenied({ back = '/admin/dashboard' }: { back?: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mb-5">
        <ShieldX className="w-8 h-8 text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-sm text-zinc-500 mb-6 text-center max-w-sm">
        You don&apos;t have permission to access this page. Contact your store owner to request access.
      </p>
      <Link
        href={back}
        className="px-5 py-2.5 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Go Back
      </Link>
    </div>
  )
}
