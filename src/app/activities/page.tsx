'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { ActiviteitenSectie } from '@/components/ActiviteitenSectie'

// v2.4.93: dunne wrapper — de daadwerkelijke content zit in
// ActiviteitenSectie.tsx (Navigatie-architectuur v1.0). Deze route
// blijft bestaan voor eventuele diepe links, staat niet meer in de
// navigatiebalk (Activiteiten is nu de eerste sectie binnen Voortgang).
export default function ActiviteitenPage() {
  const router = useRouter()
  return (
    <AppShell>
      <div className="flex items-center gap-3 px-4 pt-6">
        <button onClick={() => router.push('/progressie')} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center active:bg-white/10">
          <ArrowLeft size={20} className="text-slate-400" />
        </button>
      </div>
      <ActiviteitenSectie />
    </AppShell>
  )
}
