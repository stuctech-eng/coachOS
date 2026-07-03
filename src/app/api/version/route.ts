export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import packageJson from '../../../../package.json'

// v2.4.14: enige bron van waarheid voor het app-versienummer.
// package.json is leidend — hoe-werkt-het/page.tsx en de automatische
// update-detectie op Home lezen allebei via deze route, in plaats van een
// eigen hardcoded versienummer bij te houden. Zie README sectie
// "Versienummer — één bron van waarheid".
export async function GET() {
  return NextResponse.json({ version: packageJson.version })
}
