export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { haalWekelijkseVolumes, haalCTLATLTSB, haalRecords, haalVermogenscurve } from '@/lib/specialists/cycling-grafieken'

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const url = new URL(req.url)
    const weken = parseInt(url.searchParams.get('weken') || '12', 10)

    const [wekelijkseVolumes, ctlAtlTsb, records, vermogenscurve] = await Promise.all([
      haalWekelijkseVolumes(user.id, weken),
      haalCTLATLTSB(user.id, weken * 7),
      haalRecords(user.id),
      haalVermogenscurve(user.id),
    ])

    return NextResponse.json({
      wekelijkse_volumes: wekelijkseVolumes,
      ctl_atl_tsb: ctlAtlTsb,
      records,
      vermogenscurve,
      tss_is_schatting: true, // expliciet in de respons — geen NP beschikbaar
    })
  } catch (err) {
    console.error('[specialists/cycling/grafieken]', err)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}
