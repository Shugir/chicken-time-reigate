'use client'

import { ArrowRight, RotateCcw } from 'lucide-react'
import { receiptTotals, type ReceiptLine } from '@/lib/customizer-layout'
import QtyStepper from './QtyStepper'

interface Props {
  number: string
  itemName: string
  basePrice: number
  unit: number
  qty: number
  onQtyChange: (n: number) => void
  lines: ReceiptLine[]
  onAdd: () => void
  onReset: () => void
  showActions: boolean
}

const money = (n: number) => `£${n.toFixed(2)}`

function AmountText({ amount }: { amount: ReceiptLine['amount'] }) {
  if (amount === 'included') return <span className="tabular-nums">Included</span>
  if (amount === 'free') return <span className="tabular-nums">Free</span>
  return <span className="tabular-nums">+£{amount.toFixed(2)}</span>
}

/**
 * The full-page customizer's live receipt (Stitch "Complete Customizer" group 09).
 * Sticky positioning is applied by the page, not here.
 */
export default function SelectionReceipt({
  number, itemName, basePrice, unit, qty, onQtyChange, lines, onAdd, onReset, showActions,
}: Props) {
  const totals = receiptTotals(basePrice, unit, qty)

  return (
    <aside aria-label="Your selection" className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="w-8 h-8 shrink-0 rounded-full bg-brand-red text-white text-xs font-bold flex items-center justify-center tabular-nums"
          >
            {number}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-brand-dark">Your Selection</h2>
            <p className="text-sm text-zinc-500">Comprehensive meal build</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Live total</p>
          <p className="text-brand-red font-black tabular-nums">{money(totals.subtotal)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <span className="font-semibold text-brand-dark">{itemName}</span>
        <span className="tabular-nums text-brand-dark">{money(basePrice)}</span>
      </div>

      <div className="space-y-1.5">
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-400">No changes, served as described.</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="text-brand-red font-bold tabular-nums">[{line.tag}]</span>{' '}
                <span className="text-zinc-700">{line.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-zinc-700">
                <AmountText amount={line.amount} />
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100">
        <span className="text-sm font-semibold text-brand-dark">Quantity</span>
        <QtyStepper value={qty} onChange={onQtyChange} label={itemName} min={1} max={99} />
      </div>

      <div className="space-y-1.5 pt-3 border-t border-zinc-100 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Base Meal</span>
          <span className="tabular-nums text-zinc-700">{money(totals.base)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Customizations &amp; Extras</span>
          <span className="tabular-nums text-zinc-700">+{money(totals.customizations)}</span>
        </div>
        {qty > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Quantity</span>
            <span className="tabular-nums text-zinc-700">&times; {qty}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 font-bold text-brand-dark">
          <span>Order Subtotal</span>
          <span className="tabular-nums">{money(totals.subtotal)}</span>
        </div>
      </div>

      {showActions && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onAdd}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-brand-red hover:bg-red-700 text-white font-bold uppercase tracking-wide rounded-2xl px-4 py-3 transition-colors"
          >
            <span>Add custom meal to bag</span>
            <span className="tabular-nums">{money(totals.subtotal)}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onReset}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-700 font-semibold transition-colors"
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span>Reset all</span>
          </button>
        </div>
      )}
    </aside>
  )
}
