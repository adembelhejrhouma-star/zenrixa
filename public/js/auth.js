async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

async function logIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

function getLoginErrorMessage(err) {
  const message = (err && err.message) || '';
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid email') || lower.includes('invalid password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address before logging in.';
  }
  if (lower.includes('too many')) {
    return 'Too many login attempts. Please try again later.';
  }
  return message || 'Unable to log in. Please try again.';
}

async function logOut() {
  const { error } = await supabaseClient.auth.signOut()
  if (error) throw new Error(error.message)
}

async function getCurrentUser() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser()
    return user || null
  } catch {
    return null
  }
}

async function getSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession()
    return session ? { user: session.user } : null
  } catch {
    return null
  }
}

function onAuthStateChange(callback) {
  return supabaseClient.auth.onAuthStateChange(callback)
}

async function getProfile(userId) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user || (userId && user.id !== userId)) return null
    return {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'user',
      plan: user.user_metadata?.plan || 'free',
      full_name: user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: user.created_at
    }
  } catch {
    return null
  }
}

async function getCurrentProfile() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'user',
      plan: user.user_metadata?.plan || 'free',
      full_name: user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: user.created_at
    }
  } catch {
    return null
  }
}

async function getUserRole() {
  const profile = await getCurrentProfile()
  return profile ? (profile.role || profile.plan) : null
}

async function isProvider() {
  const role = await getUserRole()
  return role === 'provider'
}

async function requireRole(requiredRole) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  const role = await getUserRole()
  if (role !== requiredRole) throw new Error(`Requires role: ${requiredRole}`)
  return true
}

async function logAuthEvent(event_type, email, status, error_message) {
  try {
    const user = await getCurrentUser()
    await supabaseClient.from('auth_logs').insert({
      event_type,
      email: email || user?.email || null,
      user_id: user?.id || null,
      status,
      error_message: error_message || null
    })
  } catch (err) {
    console.error('Failed to log auth event:', err.message)
  }
}

async function syncUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  return getProfile(user.id)
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
    const user = session?.user
    const eventType = event === 'SIGNED_IN' ? 'login' : event === 'SIGNED_OUT' ? 'logout' : 'signup'
    await supabaseClient.from('auth_logs').insert([{
      event_type: eventType,
      email: user?.email || null,
      user_id: user?.id || null,
      status: 'success'
    }]).catch(console.error)
  }
})