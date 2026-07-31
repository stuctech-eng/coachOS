'use client'
import { redirect } from 'next/navigation'

// v2.4.198 (Coach Planning, Fase A stap 1): /life-events is verplaatst
// naar /coach-planning (met de Regels-tab als standaard). Deze redirect
// voorkomt dat bestaande links/bladwijzers breken.
export default function LifeEventsRedirect() {
  redirect('/coach-planning')
}
