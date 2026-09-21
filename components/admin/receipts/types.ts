// components/admin/receipts/types.ts

export interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number
  extras: { name: string; price: number; qty?: number; category?: string }[]
  removals: string[]
  spicy_level?: string | null
  additions?: string[] | null
  notes: string | null
}

export interface AdminReceiptOrder {
  id: string
  created_at: string
  order_type: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_notes: string | null
  delivery_address: string | null
  delivery_postcode: string | null
  total_amount: number
  status: string
  delivery_status: string | null
  promo_code_used: string | null
  discount_applied: number
  applied_deals: { deal_id: string; name: string; type: string; savings: number }[] | null
  driver_id: string | null
  driver_name: string | null
  stripe_session_id: string | null
  order_items: OrderItem[]
}

export interface ReceiptsApiResponse {
  orders: AdminReceiptOrder[]
  total: number
  page: number
  pages: number
  summary: { revenue: number }
}

export interface FilterParams {
  q: string
  driver_id: string
  status: string          // comma-separated e.g. "delivered,failed"
  date_from: string       // YYYY-MM-DD
  date_to: string         // YYYY-MM-DD
  amount_min: string
  amount_max: string
  page: string
  view: 'table' | 'cards'
}
