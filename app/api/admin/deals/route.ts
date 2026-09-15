import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['bogo', 'bundle', 'fixed_meal', 'order_discount']

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateConfig(type: string, config: unknown): string | null {
  if (!isPlainObject(config)) return 'config must be an object'
  const c = config

  if (type === 'bogo') {
    if (!isPlainObject(c.buy)) return 'bogo requires buy to be an object'
    if (!isPlainObject(c.get)) return 'bogo requires get to be an object'
    const buy = c.buy
    const get = c.get
    if (typeof buy.qty !== 'number' || buy.qty < 1) return 'bogo buy.qty must be a number >= 1'
    if (typeof get.qty !== 'number' || get.qty < 1) return 'bogo get.qty must be a number >= 1'
    const discount = get.discount
    const validDiscount =
      discount === 'free' ||
      (isPlainObject(discount) && typeof discount.percent === 'number' && discount.percent >= 0 && discount.percent <= 100)
    if (!validDiscount) return "bogo get.discount must be 'free' or an object with a percent between 0 and 100"
  }

  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
    for (let i = 0; i < c.groups.length; i++) {
      const group = c.groups[i]
      if (!isPlainObject(group)) return `bundle group ${i} is not an object`
      if (typeof group.label !== 'string' || !group.label.trim()) return `bundle group ${i} is missing a label`
      if (typeof group.category !== 'string' || !group.category.trim()) return `bundle group ${i} is missing a category`
      if (typeof group.pick_qty !== 'number' || group.pick_qty <= 0) return `bundle group ${i} pick_qty must be a positive number`
    }
  }

  if (type === 'fixed_meal') {
    if (!Array.isArray(c.items) || c.items.length === 0) return 'fixed_meal requires a non-empty items array'
    if (typeof c.price !== 'number' || c.price < 0) return 'fixed_meal requires a non-negative price'
    for (let i = 0; i < c.items.length; i++) {
      const item = c.items[i]
      if (!isPlainObject(item)) return `fixed_meal item ${i} is not an object`
      if (typeof item.item_id !== 'string' || !item.item_id.trim()) return `fixed_meal item ${i} is missing an item_id`
      if (typeof item.qty !== 'number' || item.qty <= 0) return `fixed_meal item ${i} qty must be a positive number`
    }
  }

  if (type === 'order_discount') {
    if (c.scope !== 'order' && c.scope !== 'category') return 'order_discount scope must be order or category'
    if (!isPlainObject(c.discount)) return 'order_discount requires discount to be an object'
    const discount = c.discount
    if (discount.type !== 'percent' && discount.type !== 'amount') return "order_discount discount.type must be 'percent' or 'amount'"
    if (typeof discount.value !== 'number' || discount.value < 0) return 'order_discount discount.value must be a non-negative number'
    if (discount.type === 'percent' && discount.value > 100) return 'order_discount discount.value must be <= 100 when type is percent'
  }

  return null
}

export async function GET() {
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Deals')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const userPerms = await getUserPermissions()
  if (!userPerms || !hasPermission(userPerms, 'Deals')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, name, config, is_active = true } = await request.json()

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const configError = validateConfig(type, config)
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('deals')
    .insert({ type, name: name.trim(), config, is_active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
