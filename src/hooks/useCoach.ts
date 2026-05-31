'use client'
import { useEffect, useCallback } from 'react'
import { useUserStore } from '@/store/userStore'
import { useCoachStore } from '@/store/coachStore'
import { checkinService } from '@/services/checkin'
import { coachService } from '@/services/coach'

export function useCoach() {
  const { user } = useUserStore()
  const { todayRecommendation, todayCheckin, todayStatus, isGenerating, setRecommendation, setCheckin, setStatus, setGenerating } = useCoachStore()

  useEffect(() => {
    if (!user) return
    // Load today's data
    checkinService.getTodayCheckin(user.id).then(setCheckin)
    coachService.getTodayRecommendation(user.id).then(setRecommendation)
    coachService.getTodayStatus(user.id).then(setStatus)
  }, [user, setCheckin, setRecommendation, setStatus])

  const generateAdvice = useCallback(async () => {
    if (!user || isGenerating) return
    setGenerating(true)
    try {
      const response = await fetch('/api/coach/daily', { method: 'POST' })
      const data = await response.json()
      setRecommendation(data)
      const status = await coachService.getTodayStatus(user.id)
      setStatus(status)
    } catch (error) {
      console.error('Coach generation failed:', error)
    } finally {
      setGenerating(false)
    }
  }, [user, isGenerating, setGenerating, setRecommendation, setStatus])

  return {
    recommendation: todayRecommendation,
    checkin: todayCheckin,
    status: todayStatus,
    isGenerating,
    generateAdvice,
    hasCheckin: !!todayCheckin,
  }
}
