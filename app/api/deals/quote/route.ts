import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { matchDeals, isDealLive, type Deal, type DealCartItem, type MenuItemLite } from '@/lib/deal-engine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { items } = (await request.json()) as { items: DealCartItem[] }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ applied: [], totalDiscount: 0 })
  }

  const itemIds = items.map((i) => i.menu_item_id).filter((id): id is string => Boolean(id))
  const [{ data: deals }, { data: menuItems }] = await Promise.all([
    supabaseAdmin.from('deals').select('id, type, name, config, is_active, available_from, available_until').eq('is_active', true),
    supabaseAdmin.from('menu_items').select('id, price, category, is_available').in('id', itemIds),
  ])

  const menuItemsById = new Map<string, MenuItemLite>(
    (menuItems ?? []).map((m) => [m.id, { id: m.id, price: Number(m.price), category: m.category, is_available: m.is_available }]),
  )

  const liveDeals = (deals ?? []).filter((d) => isDealLive(d)) as Deal[]
  const result = matchDeals(items, liveDeals, menuItemsById)
  return NextResponse.json(result)
}
