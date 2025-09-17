import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get user data and redirect based on role
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: userData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const role =
          userData && typeof userData === 'object' && 'role' in userData
            ? (userData as { role?: string }).role
            : undefined

        const redirectUrl = role === 'student'
          ? `${origin}/student`
          : role === 'professor'
          ? `${origin}/professor`
          : `${origin}${next}`

        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
