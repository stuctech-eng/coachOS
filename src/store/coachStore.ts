import { create } from 'zustand'
import { CoachRecommendation, DailyCheckin, DailyStatus } from '@/types'

interface CoachState {
  todayRecommendation: CoachRecommendation | null
  todayCheckin: DailyCheckin | null
  todayStatus: DailyStatus | null
  isGenerating: boolean
  setRecommendation: (rec: CoachRecommendation | null) => void
  setCheckin: (checkin: DailyCheckin | null) => void
  setStatus: (status: DailyStatus | null) => void
  setGenerating: (generating: boolean) => void
}

export const useCoachStore = create<CoachState>((set) => ({
  todayRecommendation: null,
  todayCheckin: null,
  todayStatus: null,
  isGenerating: false,
  setRecommendation: (todayRecommendation) => set({ todayRecommendation }),
  setCheckin: (todayCheckin) => set({ todayCheckin }),
  setStatus: (todayStatus) => set({ todayStatus }),
  setGenerating: (isGenerating) => set({ isGenerating }),
}))
