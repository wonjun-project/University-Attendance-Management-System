import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

interface SessionData {
  userId: string
  userType: 'student' | 'professor'
  name: string
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Get auth token from cookies
  const token = request.cookies.get('auth-token')?.value

  // Verify token
  let user: SessionData | null = null
  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jwtVerify(token, secret)
      user = payload as unknown as SessionData
    } catch (error) {
      user = null
    }
  }

  // Protected routes
  const protectedPaths = ['/student', '/professor']
  const authPaths = ['/auth/login', '/auth/signup']
  
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  const isAuthPath = authPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect authenticated users away from auth pages
  if (user && isAuthPath) {
    const redirectUrl = user.userType === 'student' 
      ? new URL('/student', request.url)
      : user.userType === 'professor' 
      ? new URL('/professor', request.url)
      : new URL('/', request.url)

    return NextResponse.redirect(redirectUrl)
  }

  // Redirect unauthenticated users to login
  if (!user && isProtectedPath) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based access control
  if (user && isProtectedPath) {
    // Students can only access /student paths
    if (user.userType === 'student' && request.nextUrl.pathname.startsWith('/professor')) {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    
    // Professors can only access /professor paths
    if (user.userType === 'professor' && request.nextUrl.pathname.startsWith('/student')) {
      return NextResponse.redirect(new URL('/professor', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}