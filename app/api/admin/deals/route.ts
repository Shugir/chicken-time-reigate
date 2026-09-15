import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserPermissions, hasPermission } from '@/lib/get-user-permissions'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['bogo', 'bundle', 'fixed_meal', 'order_discount']

function validateConfig(type: string, config: unknown): string | null {
  if (typeof config !== 'object' || config === null) return 'config must be an object'
  const c = config as Record<string, unknown>
  if (type === 'bogo') {
    if (typeof c.buy !== 'object' || typeof c.get !== 'object') return 'bogo requires buy and get'
  }
  if (type === 'bundle') {
    if (!Array.isArray(c.groups) || c.groups.length === 0) return 'bundle requires a non-empty groups array'
    if (typeof c.price !== 'number' || c.price < 0) return 'bundle requires a non-negative price'
  }
  if (type === 'fixed_meal') {
    if (!Array.isArray(c.items) || c.items.length === 0) return 'fixed_meal requires a non-empty items array'
    if (typeof c.price !== 'number' || c.price < 0) return 'fixed_meal requires a non-negative price'
  }
  if (type === 'order_discount') {
    if (c.scope !== 'order' && c.scope !== 'category') return 'order_discount scope must be order or category'
    if (typeof c.discount !== 'object') return 'order_discount requires a discount object'
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
