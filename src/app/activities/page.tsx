'use client'

import { AppShell } from '@/components/layout'
import { ActiviteitenSectie } from '@/components/ActiviteitenSectie'

// v2.4.111: Activiteiten is weer een primaire tab (op verzoek, de
// balk is al horizontaal scrollbaar) — geen terugknop meer nodig,
// consistent met de andere hoofdtabs (Home, Coach, Trainer,
// Specialisten, Voortgang hebben ook geen terugpijltje).
export default function ActiviteitenPage() {
  return (
    <AppShell>
      <ActiviteitenSectie />
    </AppShell>
  )
}
