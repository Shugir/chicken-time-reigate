import {
  formatTime, formatDateMedium,
} from '@/lib/utils/format-date'

interface ReceiptItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras: { name: string; price: number }[]
  removals: string[]
  notes: string | null
}

export interface ReceiptOrder {
  id: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  customer_notes: string | null
  total_amount: number
  order_items?: ReceiptItem[]
}

export function CustomerReceipt({ order }: { order: ReceiptOrder }) {
  const date = new Date(order.created_at)
  const items = order.order_items ?? []
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0)

  return (
    <div className="receipt-print hidden print:block w-[80mm] text-black bg-white font-mono text-xs p-3">
      <div className="text-center mb-3">
        <p className="font-black text-sm tracking-widest uppercase">Chicken Time</p>
        <p className="font-black text-sm tracking-widest uppercase">Reigate</p>
        <p className="text-xs mt-1">01737 000 000</p>
        <p className="text-xs">chickentimesurrey.co.uk</p>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between mb-0.5">
        <span>Order</span>
        <span className="font-black">#{order.id.slice(-6).toUpperCase()}</span>
      </div>
      <div className="flex justify-between mb-0.5">
        <span>Date</span>
        <span>{formatDateMedium(date)}</span>
      </div>
      <div className="flex justify-between mb-0.5">
        <span>Time</span>
        <span>{formatTime(date)}</span>
      </div>
      {order.customer_name && (
        <div className="flex justify-between mb-0.5">
          <span>Customer</span>
          <span className="font-bold">{order.customer_name}</span>
        </div>
      )}
      {order.customer_phone && (
        <div className="flex justify-between mb-0.5">
          <span>Phone</span>
          <span>{order.customer_phone}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black my-2" />
      <div className="mb-2">
        {items.map((item) => (
          <div key={item.id} className="mb-2">
            <div className="flex justify-between">
              <span className="font-bold">{item.quantity}x {item.item_name ?? 'Item'}</span>
              <span className="font-bold">£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 pl-2">
              <span>@ £{item.unit_price.toFixed(2)} each</span>
            </div>
            {(item.extras ?? []).length > 0 && (item.extras ?? []).map((e) => (
              <div key={e.name} className="flex justify-between pl-2 text-gray-600" style={{ fontSize: '10px' }}>
                <span>+ {e.name}</span>
                <span>£{e.price.toFixed(2)}</span>
              </div>
            ))}
            {(item.removals ?? []).length > 0 && (item.removals ?? []).map((r) => (
              <div key={r} className="pl-2 text-gray-500" style={{ fontSize: '10px' }}>
                - No {r}
              </div>
            ))}
            {item.notes && (
              <div className="pl-2 text-gray-600 italic" style={{ fontSize: '10px' }}>{item.notes}</div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between mb-0.5">
        <span>Subtotal</span>
        <span>£{subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Delivery</span>
        <span>£{(order.total_amount - subtotal).toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-black text-sm border-t border-black pt-1 mt-1">
        <span>TOTAL</span>
        <span>£{order.total_amount.toFixed(2)}</span>
      </div>

      {order.delivery_address && (
        <>
          <div className="border-t border-black mt-3 pt-2">
            <p className="text-center font-black text-xs tracking-widest uppercase mb-2">
              --- DELIVERY DETAILS ---
            </p>
            {order.customer_name && (
              <p className="font-black text-sm leading-snug">{order.customer_name}</p>
            )}
            {order.customer_phone && (
              <p className="font-black text-sm leading-snug">{order.customer_phone}</p>
            )}
            <p className="font-black text-sm leading-snug mt-1">{order.delivery_address}</p>
            {order.delivery_postcode && (
              <p className="font-black text-base tracking-widest uppercase mt-1">
                {order.delivery_postcode}
              </p>
            )}
            {order.customer_notes && (
              <p className="font-bold text-xs mt-1 border border-black px-1 py-0.5 uppercase tracking-wide">
                NOTE: {order.customer_notes}
              </p>
            )}
          </div>
          <div className="border-t border-dashed border-black mt-3 mb-2" />
        </>
      )}

      {!order.delivery_address && <div className="border-t border-dashed border-black my-3" />}
      <div className="text-center">
        <p className="font-bold">Thank you for your order!</p>
        <p className="mt-1 text-gray-500">We hope to see you again soon.</p>
        <p className="mt-2 text-gray-400">VAT Reg: GB 000 0000 00</p>
      </div>
    </div>
  )
}
