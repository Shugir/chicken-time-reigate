'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface StoreData {
  isCurrentlyOpen: boolean
  closedUntil:     string | null
  closedReason:    string
}

export function StoreStatusBanner() {
  const [status, setStatus]       = useState<StoreData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/store-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus({ isCurrentlyOpen: d.isCurrentlyOpen, closedUntil: d.closedUntil, closedReason: d.closedReason }) })
      .catch(() => {})
  }, [])

  if (!status || status.isCurrentlyOpen || dismissed) return null

  return (
    <div className="relative bg-amber-500 text-amber-950 px-4 py-3 text-center text-sm font-semibold z-40">
      🍗 We&apos;re currently closed.
      {status.closedUntil && <span className="ml-1.5">{status.closedUntil}.</span>}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-amber-600/20 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}
