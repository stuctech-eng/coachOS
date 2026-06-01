import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: 'https://coach-os-tau.vercel.app/api/strava/callback',
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  })

  const stravaUrl = 'https://www.strava.com/oauth/authorize?' + params.toString()
  return NextResponse.redirect(stravaUrl)
}
