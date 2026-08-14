import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  runtime: 'edge',//
  matcher: [
    '/',           //
    '/login',
    '/signup',
    '/landing',    // ou landing.html
    '/account/:path*',
    '/dashboard/:path*',
    '/checkout',
    '/checkout/:path*',
    '/api/auth/:path*',
  ],
}
