import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('removals, extras, allergens')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const removalSet  = new Set<string>()
  const extrasSet   = new Set<string>()
  const allergenSet = new Set<string>()

  for (const row of data ?? []) {
    for (const r of (row.removals as string[] | null) ?? []) {
      if (typeof r === 'string' && r.trim()) removalSet.add(r.trim())
    }
    for (const e of (row.extras as Array<{ name: string; price: number }> | null) ?? []) {
      if (e?.name?.trim()) extrasSet.add(e.name.trim())
    }
    for (const a of (row.allergens as string[] | null) ?? []) {
      if (typeof a === 'string' && a.trim()) allergenSet.add(a.trim())
    }
  }

  return NextResponse.json({
    removals:  [...removalSet].sort((a, b) => a.localeCompare(b)),
    extras:    [...extrasSet].sort((a, b) => a.localeCompare(b)),
    allergens: [...allergenSet].sort((a, b) => a.localeCompare(b)),
  })
}
