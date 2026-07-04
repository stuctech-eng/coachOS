'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, TrendingUp, MessageCircle, Settings } from 'lucide-react'
import { cn } from '@/utils'
import { useEffect, useRef } from 'react'

const navItems = [
  { href: '/home',       icon: Home,        label: 'Home' },
  { href: '/training',   icon: Dumbbell,    label: 'Training' },
  { href: '/progressie', icon: TrendingUp,  label: 'Progressie' },
  { href: '/chat',       icon: MessageCircle, label: 'Coach' },
  { href: '/settings',   icon: Settings,    label: 'Instellingen' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-coach-darker/95 backdrop-blur-xl border-t border-coach-border safe-bottom">
      <div className="flex items-center justify-around px-1 pt-2 pb-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={cn('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all', isActive ? 'text-primary-400' : 'text-slate-500')}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// v2.4.20 FIX — DEFINITIEVE OORZAAK van het "scroll reset bij terugkeer"
// probleem (v2.4.17 t/m v2.4.19 losten dit niet op, want ze gingen uit van
// window-scroll). De daadwerkelijke scrollbare container is dit <main>
// element (class "scroll-area"), NIET window — de buitenste div heeft
// "overflow-hidden". Browser- en Next.js-scrollherstel werken alleen op
// window.scrollTo en hebben dus NOOIT effect gehad op dit element, ongeacht
// router.back()/replace() of synchrone data-loading (v2.4.17-19).
// Fix: scrollTop van dit element wordt zelf bijgehouden in sessionStorage,
// per pathname, en hersteld bij het opnieuw mounten van dezelfde route.
// Zit in AppShell zelf — werkt hierdoor voor de hele app, niet alleen
// Training/Archief.
const SCROLL_KEY_PREFIX = 'coachos_scroll_'

function useScrollRestore(pathname: string) {
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const key = SCROLL_KEY_PREFIX + pathname

    // Herstel — dubbele poging (direct + na een korte tick) omdat content
    // soms nog een fractie van een seconde na mount van hoogte verandert
    // (bv. afbeeldingen die laden, of data die net iets later binnenkomt)
    const herstel = () => {
      try {
        const saved = sessionStorage.getItem(key)
        if (saved !== null) {
          el.scrollTop = parseInt(saved, 10)
        }
      } catch { /* sessionStorage niet beschikbaar — geen probleem, gewoon niet herstellen */ }
    }
    herstel()
    const laatTimer = setTimeout(herstel, 150)

    // Bewaar — bij elke scroll-beweging opslaan (passief, geen performance-impact)
    const handleScroll = () => {
      try { sessionStorage.setItem(key, String(el.scrollTop)) } catch { /* */ }
    }
    el.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(laatTimer)
      el.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

  return mainRef
}

export function AppShell({ children, className, showNav = true }: { children: React.ReactNode; className?: string; showNav?: boolean }) {
  const pathname = usePathname()
  const mainRef = useScrollRestore(pathname)

  return (
    <div className="h-screen flex flex-col bg-coach-dark overflow-hidden">
      <main ref={mainRef} className={cn('flex-1 scroll-area safe-top', showNav ? 'pb-24' : 'pb-0', className)}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
