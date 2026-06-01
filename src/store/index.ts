import { create } from 'zustand'
import { Profile, UserGoal, CoachRecommendation, DailyCheckin } from '@/types'
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

interface CoachState {
  recommendation: CoachRecommendation | null
  checkin: DailyCheckin | null
  isGenerating: boolean
  setRecommendation: (rec: CoachRecommendation | null) => void
  setCheckin: (checkin: DailyCheckin | null) => void
  setGenerating: (generating: boolean) => void
}

export const useCoachStore = create<CoachState>((set) => ({
  recommendation: null,
  checkin: null,
  isGenerating: false,
  setRecommendation: (recommendation) => set({ recommendation }),
  setCheckin: (checkin) => set({ checkin }),
  setGenerating: (isGenerating) => set({ isGenerating }),
}))
