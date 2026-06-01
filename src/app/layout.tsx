import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'

export const metadata: Metadata = {
  title: 'CoachOS',
  description: 'Jouw persoonlijke AI coach',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CoachOS' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0F172A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="dark">
      <body className={GeistSans.className + ' bg-coach-dark text-slate-100 h-screen overflow-hidden'}>
        {children}
      </body>
    </html>
  )
}
