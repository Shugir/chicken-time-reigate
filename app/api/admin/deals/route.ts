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
  }

  return null
}

export async function GET() {
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
