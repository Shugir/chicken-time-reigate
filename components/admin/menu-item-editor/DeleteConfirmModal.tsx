'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { FOCUS_RING } from './constants'

export default function DeleteConfirmModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-item-title" aria-describedby="delete-item-desc" className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <Trash2 className="w-5 h-5 text-red-400" aria-hidden="true" />
        </div>
        <h3 id="delete-item-title" className="text-white font-semibold mb-1">Delete &ldquo;{name}&rdquo;?</h3>
        <p id="delete-item-desc" className="text-zinc-400 text-sm mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button autoFocus onClick={onClose} className={`flex-1 h-11 px-4 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors ${FOCUS_RING}`}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`flex-1 h-11 flex items-center justify-center gap-2 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 ${FOCUS_RING}`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Deleting" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
