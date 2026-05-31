'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/services/supabase'
import { profileService } from '@/services/profile'
import { useUserStore } from '@/store/userStore'

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, setGoals, setLoading, reset } = useUserStore()
  const router = useRouter()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        profileService.getProfile(session.user.id).then((p) => {
          setProfile(p)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await profileService.getProfile(session.user.id)
        setProfile(p)
        const goals = await profileService.getGoals(session.user.id)
        setGoals(goals)
      } else {
        reset()
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setProfile, setGoals, setLoading, reset])

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    router.push('/login')
  }

  return { user, profile, isLoading, signOut }
}
