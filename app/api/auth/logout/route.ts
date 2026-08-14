import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.auth.signOut()

  if (user) {
    await supabase.from('auth_logs').insert({
      event_type: 'logout',
      email: user.email,
      user_id: user.id,
      status: 'success'
    })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
