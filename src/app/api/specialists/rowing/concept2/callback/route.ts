export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// v2.4.218 (Rowing Platform Fase 1): Concept2 OAuth callback.
// Documentatie: log.concept2.com/developers/documentation/
//
// POST https://log.concept2.com/oauth/access_token
// Content-Type: application/x-www-form-urlencoded
// Body: client_id, client_secret, grant_type=authorization_code,
//       redirect_uri, code, scope
//
// Response: { access_token, token_type, expires_in, refresh_token }
// expires_in is in seconden (bijv. 604800 = 7 dagen).

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.redirect(new URL('/login', req.url))

    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(new URL(`/coach/rowing?concept2_error=${encodeURIComponent(error)}`, req.url))
    }
    if (!code) {
      return NextResponse.redirect(new URL('/coach/rowing?concept2_error=geen_code', req.url))
    }

    const clientId = process.env.CONCEPT2_CLIENT_ID
    const clientSecret = process.env.CONCEPT2_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      console.error('[concept2/callback] CONCEPT2_CLIENT_ID/SECRET ontbreken')
      return NextResponse.redirect(new URL('/coach/rowing?concept2_error=configuratie', req.url))
    }

    const redirectUri = `${req.nextUrl.origin}/api/specialists/rowing/concept2/callback`

    const tokenRes = await fetch('https://log.concept2.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
        scope: 'results:read',
      }),
    })

    if (!tokenRes.ok) {
      const tekst = await tokenRes.text()
      console.error('[concept2/callback] Token-uitwisseling mislukt:', tokenRes.status, tekst)
      return NextResponse.redirect(new URL('/coach/rowing?concept2_error=token_uitwisseling_mislukt', req.url))
    }

    const tokenData = await tokenRes.json() as {
      access_token: string; token_type: string; expires_in: number; refresh_token: string
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const supabase = createAdminClient()
    const { error: dbError } = await supabase.from('concept2_tokens').upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      scope: 'results:read',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (dbError) {
      console.error('[concept2/callback] Opslaan token mislukt:', dbError)
      return NextResponse.redirect(new URL('/coach/rowing?concept2_error=opslaan_mislukt', req.url))
    }

    return NextResponse.redirect(new URL('/coach/rowing?concept2_verbonden=1', req.url))
  } catch (err) {
    console.error('[concept2/callback]', err)
    return NextResponse.redirect(new URL('/coach/rowing?concept2_error=onbekende_fout', req.url))
  }
}
