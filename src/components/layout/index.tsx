'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Activity, CheckSquare, Settings, Brain, MessageCircle } from 'lucide-react'
import { cn } from '@/utils'

const navItems = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/checkin', icon: CheckSquare, label: 'Check-in' },
  { href: '/chat', icon: MessageCircle, label: 'Coach' },
  { href: '/activities', icon: Activity, label: 'Activiteiten' },
  { href: '/settings', icon: Settings, label: 'Instellingen' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-coach-darker/95 backdrop-blur-xl border-t border-coach-border safe-bottom">
      <div className="flex items-center justify-around px-1 pt-2 pb-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
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

export function AppShell({ children, className, showNav = true }: { children: React.ReactNode; className?: string; showNav?: boolean }) {
  return (
    <div className="h-screen flex flex-col bg-coach-dark overflow-hidden">
      <main className={cn('flex-1 scroll-area safe-top', showNav ? 'pb-24' : 'pb-0', className)}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
