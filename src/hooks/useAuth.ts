'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { browserClient } from '@/lib/supabase'
import { useUserStore } from '@/store'

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, setGoals, setLoading, reset } = useUserStore()
  const router = useRouter()

  useEffect(() => {
    browserClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetch('/api/profile')
          .then(r => r.json())
          .then(data => { setProfile(data.profile); setGoals(data.goals || []); setLoading(false) })
          .catch(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = browserClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetch('/api/profile').then(r => r.json()).then(data => { setProfile(data.profile); setGoals(data.goals || []) }).catch(() => {})
      } else {
        reset()
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setProfile, setGoals, setLoading, reset])

  const signOut = async () => {
    await browserClient.auth.signOut()
    reset()
    router.push('/login')
  }

  return { user, profile, isLoading, signOut }
}
