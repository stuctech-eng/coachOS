import { create } from 'zustand'
import { Profile, UserGoal } from '@/types'
import { User } from '@supabase/supabase-js'

interface UserState {
  user: User | null
  profile: Profile | null
  goals: UserGoal[]
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setGoals: (goals: UserGoal[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  goals: [],
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setGoals: (goals) => set({ goals }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, profile: null, goals: [], isLoading: false }),
}))
