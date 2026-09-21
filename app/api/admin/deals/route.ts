import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['bogo', 'bundle', 'order_discount']

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
    // Each side targets specific items (item_ids) or, for legacy deals, a category
    for (const [label, side] of [['buy', buy], ['get', get]] as const) {
      const hasItems = Array.isArray(side.item_ids) && side.item_ids.length > 0 && side.item_ids.every((id) => typeof id === 'string')
      const hasCategory = typeof side.category === 'string' && side.category.trim() !== ''
      if (!hasItems && !hasCategory) return `bogo ${label} requires at least one item`
    }
    const discount = get.discount
    const validDiscount =
      discount === 'free' ||
      (isPlainObject(discount) && typeof discount.percent === 'number' && discount.percent >= 0 && discount.percent <= 100)
    if (!validDiscount) return "bogo get.discount must be 'free' or an object with a percent between 0 and 100"
  }

  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
    if (c.price_type !== undefined && c.price_type !== 'fixed' && c.price_type !== 'percent') return "bundle price_type must be 'fixed' or 'percent'"
    if (c.price_type === 'percent' && (typeof c.discount_percent !== 'number' || c.discount_percent <= 0 || c.discount_percent > 100)) {
      return 'bundle discount_percent must be a number greater than 0 and at most 100'
    }
    for (let i = 0; i < c.groups.length; i++) {
      const group = c.groups[i]
      if (!isPlainObject(group)) return `bundle group ${i} is not an object`
      if (typeof group.label !== 'string' || !group.label.trim()) return `bundle group ${i} is missing a label`
      if (typeof group.min_qty !== 'number' || group.min_qty < 0) return `bundle group ${i} min_qty must be a non-negative number`
      if (typeof group.max_qty !== 'number' || group.max_qty < group.min_qty) return `bundle group ${i} max_qty must be a number >= min_qty`
      if (group.category !== undefined && typeof group.category !== 'string') return `bundle group ${i} category must be a string`
      const hasCategory = typeof group.category === 'string' && group.category.trim() !== ''
      // The engine and pickers already treat a category-only slot's missing item_ids as [].
      const ids = group.item_ids ?? []
      if (!Array.isArray(ids) || (ids.length === 0 && !hasCategory) || !ids.every((id: unknown) => typeof id === 'string')) {
        return `bundle group ${i} requires a non-empty item_ids array of strings (or a category)`
      }
    }
    if (c.upgrades !== undefined) {
      const up = c.upgrades
      if (!isPlainObject(up)) return 'bundle upgrades must be an object'
      if (!Array.isArray(up.item_ids) || !up.item_ids.every((id: unknown) => typeof id === 'string')) {
        return 'bundle upgrades item_ids must be an array of strings'
      }
      if (up.item_ids.length > 30) return 'bundle upgrades can have at most 30 items'
      if (up.label !== undefined && (typeof up.label !== 'string' || up.label.length > 60)) {
        return 'bundle upgrades label must be a string of at most 60 characters'
      }
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

  const { type, name, config, is_active = true, custom_label, available_from, available_until, image_url } = await request.json()

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
    .insert({
      type, name: name.trim(), config, is_active,
      custom_label: custom_label?.trim() || null,
      available_from: available_from || null,
      available_until: available_until || null,
      image_url: image_url || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
