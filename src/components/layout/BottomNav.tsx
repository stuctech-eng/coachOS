'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Activity, CheckSquare, Settings } from 'lucide-react'
import { cn } from '@/utils'

const navItems = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/checkin', icon: CheckSquare, label: 'Check-in' },
  { href: '/activities', icon: Activity, label: 'Activiteiten' },
  { href: '/settings', icon: Settings, label: 'Instellingen' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-coach-darker/95 backdrop-blur-xl border-t border-coach-border safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200',
                isActive ? 'text-primary-400' : 'text-slate-500'
              )}
            >
              <Icon
                size={22}
                className={cn('transition-all duration-200', isActive && 'scale-110')}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
