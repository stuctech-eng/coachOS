export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

// v2.4.218 (Rowing Platform Fase 1): Concept2 OAuth2 — Authorization
// Code grant. Documentatie: log.concept2.com/developers/documentation/
//
// Endpoint: GET /oauth/authorize?client_id={}&scope={}&response_type=code&redirect_uri={}
//
// v2.4.346-CONCLUSIE (was v2.4.345-EXPERIMENT): 'results:write'
// erbij toevoegen brak de autorisatie VOLLEDIG — Concept2's eigen
// autorisatiescherm gaf direct "Application Authorization — error",
// nog vóórdat CoachOS' callback bereikt werd. Deze CoachOS-app is bij
// Concept2 kennelijk alleen geregistreerd/goedgekeurd voor
// 'results:read' — een niet-toegestane scope aanvragen breekt de
// hele koppeling, in plaats van 'm gedeeltelijk uit te breiden.
// TERUGGEDRAAID naar 'results:read' alleen. Conclusie: het lege
// concept2_user_id is GEEN scope-probleem — de oorspronkelijke
// hypothese (iets bij Concept2's /api/users/me-endpoint zelf, niet
// door CoachOS op te lossen) staat weer overeind.
//
// Scope: results:read (results:write geeft ook results:read gratis
// mee, maar we hebben nu alleen lees-toegang nodig — minst-nodige-
// rechten-principe, zoals ook bij de rest van CoachOS gehanteerd).
//
// BEWUST: user-identiteit komt in de callback via de sessie-cookie
// (consistent met elke andere route in CoachOS), niet via de state-
// parameter — state zou anders de user_id blootgeven en is geen
// betrouwbaar CSRF-mechanisme zonder een server-side opgeslagen nonce
// om tegen te verifiëren.

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const clientId = process.env.CONCEPT2_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'CONCEPT2_CLIENT_ID ontbreekt in de environment variables' }, { status: 500 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/specialists/rowing/concept2/callback`
  const authorizeUrl = new URL('https://log.concept2.com/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', 'results:read')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authorizeUrl.toString())
}
