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

interface CoachStatus {
  coach_score: number | null
  recovery_score: number | null
  training_score: number | null
  lifestyle_score: number | null
  risk_flags: string[]
  status_color: string
  date: string
}

interface CoachState {
  recommendation: CoachRecommendation | null
  checkin: DailyCheckin | null
  isGenerating: boolean
  coachStatus: CoachStatus | null
  actionPlan: Array<{ tijd: string; actie: string }> | null
  actionPlanDatum: string | null
  setRecommendation: (rec: CoachRecommendation | null) => void
  setCheckin: (checkin: DailyCheckin | null) => void
  setGenerating: (generating: boolean) => void
  setCoachStatus: (status: CoachStatus | null) => void
  setActionPlan: (plan: Array<{ tijd: string; actie: string }> | null, datum: string) => void
}

export const useCoachStore = create<CoachState>((set) => ({
  recommendation: null,
  checkin: null,
  isGenerating: false,
  coachStatus: null,
  actionPlan: null,
  actionPlanDatum: null,
  setRecommendation: (recommendation) => set({ recommendation }),
  setCheckin: (checkin) => set({ checkin }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  setCoachStatus: (coachStatus) => set({ coachStatus }),
  setActionPlan: (actionPlan, actionPlanDatum) => set({ actionPlan, actionPlanDatum }),
}))
