// components/admin/receipts/ReceiptDrawer.tsx
'use client'

import { useEffect } from 'react'
import { X, Printer, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { CustomerReceipt } from '@/components/CustomerReceipt'
import { formatDateMedium, formatTime } from '@/lib/utils/format-date'
import { STATUS_BADGE as STATUS_STYLES } from './utils'
import type { AdminReceiptOrder } from './types'

interface Props {
  order: AdminReceiptOrder | null
  onClose: () => void
}

export function ReceiptDrawer({ order, onClose }: Props) {
  useEffect(() => {
    if (!order) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [order, onClose])

  if (!order) return null

  const subtotal = order.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  function handleCopyLink() {
    const url = `${window.location.origin}/track?id=${order!.id}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Receipt link copied'))
      .catch(() => toast.error('Could not copy link'))
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Hidden receipt for print — CustomerReceipt is hidden print:block */}
      <CustomerReceipt order={order} />

      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-white">
              Order #{order.id.slice(-6).toUpperCase()}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-zinc-500">
                {formatDateMedium(order.created_at)} · {formatTime(order.created_at)}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize ${STATUS_STYLES[order.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                {order.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Customer */}
          <Section label="Customer">
            <Row k="Name"  v={order.customer_name}  bold />
            <Row k="Phone" v={order.customer_phone} />
            <Row k="Email" v={order.customer_email} />
          </Section>

          {/* Delivery */}
          <Section label="Delivery">
            <Row k="Address"  v={order.delivery_address} />
            <Row k="Postcode" v={order.delivery_postcode} bold />
            <Row k="Driver"   v={order.driver_name} bold />
            {order.customer_notes && (
              <Row k="Notes" v={order.customer_notes} muted />
            )}
          </Section>

          {/* Items */}
          <Section label="Items">
            {order.order_items.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No items recorded</p>
            ) : order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between items-start py-2 border-b border-zinc-800 last:border-0">
                <div className="flex-1">
                  <span className="text-sm font-medium text-white">{item.item_name ?? 'Item'}</span>
                  <span className="text-zinc-600 text-sm"> × {item.quantity}</span>
                  {(item.extras ?? []).map((e) => (
                    <div key={e.name} className="text-xs text-green-600 mt-0.5">+ {e.name}</div>
                  ))}
                  {(item.removals ?? []).map((r) => (
                    <div key={r} className="text-xs text-rose-800 mt-0.5">− {r}</div>
                  ))}
                  {item.notes && (
                    <div className="text-xs text-zinc-600 italic mt-0.5">{item.notes}</div>
                  )}
                </div>
                <span className="text-sm text-zinc-400 ml-3 shrink-0">
                  £{(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </Section>

          {/* Summary */}
          <Section label="Summary">
            <TotalRow k="Subtotal" v={`£${subtotal.toFixed(2)}`} />
            {order.discount_applied > 0 && (
              <TotalRow
                k={order.promo_code_used ? `Promo (${order.promo_code_used})` : 'Discount'}
                v={`−£${order.discount_applied.toFixed(2)}`}
                green
              />
            )}
            <TotalRow k="Delivery fee" v={`£${(order.total_amount - subtotal + order.discount_applied).toFixed(2)}`} />
            <TotalRow k="Total" v={`£${order.total_amount.toFixed(2)}`} grand />
          </Section>

          {/* Transaction */}
          <Section label="Transaction">
            {order.stripe_session_id && (
              <Row k="Stripe session" v={order.stripe_session_id.slice(0, 28) + '…'} mono />
            )}
            <Row k="Placed" v={`${formatDateMedium(order.created_at)}, ${formatTime(order.created_at)}`} />
          </Section>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Copy Link
          </button>
        </div>

      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-zinc-800/60">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">{label}</p>
      {children}
    </div>
  )
}

function Row({ k, v, bold, muted, mono }: { k: string; v: string | null | undefined; bold?: boolean; muted?: boolean; mono?: boolean }) {
  if (!v) return null
  return (
    <div className="flex justify-between items-baseline mb-1.5 last:mb-0 gap-2">
      <span className="text-xs text-zinc-500 shrink-0">{k}</span>
      <span className={`text-xs text-right break-all ${bold ? 'font-semibold text-white' : muted ? 'text-zinc-600 italic' : mono ? 'font-mono text-zinc-700 text-[10px]' : 'text-zinc-300'}`}>
        {v}
      </span>
    </div>
  )
}

function TotalRow({ k, v, green, grand }: { k: string; v: string; green?: boolean; grand?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-1 ${grand ? 'border-t border-zinc-700 mt-1 pt-3' : ''}`}>
      <span className={`text-sm ${grand ? 'font-bold text-white' : 'text-zinc-500'}`}>{k}</span>
      <span className={`text-sm ${grand ? 'font-bold text-green-400 text-base' : green ? 'text-green-500' : 'text-zinc-300'}`}>{v}</span>
    </div>
  )
}
