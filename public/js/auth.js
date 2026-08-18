const AUTH_API = '/api/auth'

async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${AUTH_API}/${endpoint}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function signUp(email, password) {
  return apiFetch('signup', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

async function logIn(email, password) {
  return apiFetch('login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
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
  return apiFetch('logout', { method: 'POST' })
}

async function getCurrentUser() {
  try {
    const data = await apiFetch('session')
    return data.user || null
  } catch {
    return null
  }
}

async function getSession() {
  try {
    const data = await apiFetch('session')
    return data.user ? { user: data.user } : null
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
    const data = await apiFetch('session')
    return data.profile || null
  } catch {
    return null
  }
}

// RBAC: check current user's role from auth user metadata
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
