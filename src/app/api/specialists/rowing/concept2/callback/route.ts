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

    // v2.4.286 (Concept2-webhook): Concept2's EIGEN user-id ophalen en
    // bewaren — nodig om een binnenkomende webhook-payload (die
    // Concept2's numerieke user_id bevat, geen CoachOS-koppeling) terug
    // te kunnen vertalen naar de juiste CoachOS-gebruiker. Ontbrak tot
    // nu toe volledig (geverifieerd, niet aangenomen: deze route deed
    // nooit een GET /api/users/me-aanroep). Eigen try/catch — mag de
    // OAuth-koppeling zelf nooit laten mislukken; zonder dit werkt de
    // bestaande "Sync nu"-knop gewoon door, alleen de webhook zou dan
    // niet werken voor deze gebruiker.
    let concept2UserId: number | null = null
    try {
      const meRes = await fetch('https://log.concept2.com/api/users/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.c2logbook.v1+json',
        },
      })
      if (meRes.ok) {
        const meJson = await meRes.json() as { data: { id: number } }
        concept2UserId = meJson.data?.id ?? null
      } else {
        console.error('[concept2/callback] GET /api/users/me mislukt:', meRes.status, await meRes.text())
      }
    } catch (meErr) {
      console.error('[concept2/callback] Concept2 user-id ophalen mislukt (koppeling zelf gaat door):', meErr)
    }

    const supabase = createAdminClient()
    const { error: dbError } = await supabase.from('concept2_tokens').upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      scope: 'results:read',
      concept2_user_id: concept2UserId,
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
