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
// v2.4.345-EXPERIMENT: gemeld — concept2_user_id blijft leeg na
// koppelen (GET /api/users/me faalt, zie callback/route.ts). Eerdere
// aanname (v2.4.218) was dat 'results:read' voldoende is voor alles
// wat CoachOS nodig heeft — dat blijkt niet zeker te kloppen voor het
// gebruikersprofiel-endpoint specifiek. Test nu met BEIDE bekende,
// gedocumenteerde scopes (results:write geeft results:read gratis
// mee, dus dit is geen extra, ongedocumenteerde scope-naam gokken —
// alleen de twee die al bevestigd bestaan, samen aangevraagd, voor
// het geval het gebruikersprofiel-endpoint bredere toegang vereist).
// Als dit NIET helpt: rollback naar 'results:read' alleen, en de
// oorzaak ligt dan waarschijnlijk niet bij scope maar bij Concept2
// zelf (matcht de originele, ongewijzigde hypothese).
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
  authorizeUrl.searchParams.set('scope', 'results:read results:write')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authorizeUrl.toString())
}
