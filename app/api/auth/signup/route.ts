import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    await supabase.from('auth_logs').insert({
      event_type: 'signup',
      email,
      status: 'failed',
      error_message: error.message
    })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabase.from('auth_logs').insert({
    event_type: 'signup',
    email,
    user_id: data.user?.id || null,
    status: error ? 'failed' : 'success'
  })

  return NextResponse.json({
    user: data.user,
    session: data.session
  })
}
