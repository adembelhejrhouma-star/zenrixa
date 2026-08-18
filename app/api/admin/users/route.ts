import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

async function requireProvider() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.user_metadata?.role !== 'provider') return null
  return user
}

export async function GET() {
  const caller = await requireProvider()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users = (data?.users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    role: u.user_metadata?.role || 'user',
    plan: u.user_metadata?.plan || 'free'
  }))

  return NextResponse.json({ users })
}

export async function PATCH(request: Request) {
  const caller = await requireProvider()
  if (!caller) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, role } = await request.json()
  if (!id || (role !== 'user' && role !== 'provider')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target, error: getError } = await admin.auth.admin.getUserById(id)
  if (getError || !target?.user) {
    return NextResponse.json({ error: getError?.message || 'User not found' }, { status: 404 })
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...target.user.user_metadata, role }
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}