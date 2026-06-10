import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getMenuAdminUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: perms } = await supabaseAdmin
    .from('staff_permissions')
    .select('role, permissions')
    .eq('email', user.email!)
    .maybeSingle()
  const ok = perms?.role === 'owner' || perms?.role === 'admin' || (perms?.permissions ?? []).includes('Menu')
  return ok ? user : null
}

const BUCKET = 'menu-images'

// Creates the public bucket on first use so no manual SQL/migration is required.
async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (data) return
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    fileSizeLimit: '5MB',
  })
}

export async function POST(request: NextRequest) {
  const user = await getMenuAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  await ensureBucket()

  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `menu-items/${Date.now()}.${ext}`

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
