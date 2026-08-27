import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

// ── Gedeelde authenticatie-helper ────────────────────────────────────────
// Bron: CoachOS Connect (native iOS) contract-review, 28 augustus 2026.
// Doel: routes die nu al `getUser()` als lokale, cookie-only functie
// dupliceren (104 routes t/m deze audit) kunnen deze ene, gedeelde
// functie gebruiken in plaats van hun eigen kopie.
//
// GEEN TWEEDE AUTHENTICATIESYSTEEM: zowel het Bearer- als het
// cookie-pad valideren tegen dezelfde Supabase Auth-server, dezelfde
// gebruikers, dezelfde `user.id`. Het verschil is alleen WAAR de
// sessie-informatie vandaan komt (header voor native apps, cookie voor
// de browser-PWA).
//
// Volgorde: eerst een `Authorization: Bearer <token>`-header proberen
// (native clients zoals CoachOS Connect), pas daarna terugvallen op de
// bestaande cookie-sessie (browser-PWA). Bestaand cookie-gedrag wijzigt
// niet — dit is een aanvulling, geen vervanging.
//
// LET OP voor wie dit oprolt naar bestaande routes: dit vervangt per
// route de lokale `getUser()`-functie en de losse
// `createServerClient(...)`-aanroep erin. De admin-client
// (`createAdminClient()`) voor de eigenlijke database-query blijft
// ongewijzigd — die gebruikt sowieso de service-role key, los van hoe
// de gebruiker geïdentificeerd is.

export async function getAuthenticatedUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : null

  if (bearerToken) {
    // Los JWT valideren tegen dezelfde Supabase Auth-server — geen
    // cookies nodig, dus geschikt voor een native client.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(bearerToken)
    if (user) return user
    // Val bewust NIET terug op cookies bij een ongeldig Bearer-token —
    // een client die expliciet een token meestuurt, verwacht een
    // duidelijke 401, geen stille terugval naar een andere sessie.
    return null
  }

  // Geen Bearer-header: bestaand, ongewijzigd cookie-pad voor de PWA.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        getAll: () => cookieStore.getAll(),
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
