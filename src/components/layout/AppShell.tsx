'use client'
import { BottomNav } from './BottomNav'
import { cn } from '@/utils'

interface AppShellProps {
  children: React.ReactNode
  className?: string
  showNav?: boolean
}

export function AppShell({ children, className, showNav = true }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col bg-coach-dark overflow-hidden">
      <main
        className={cn(
          'flex-1 scroll-area',
          showNav ? 'pb-24' : 'pb-0',
          'safe-top',
          className
        )}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  )
}
