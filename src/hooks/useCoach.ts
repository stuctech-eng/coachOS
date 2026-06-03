'use client'
import { useEffect, useCallback } from 'react'
import { useUserStore, useCoachStore } from '@/store'

export function useCoach() {
  const { user } = useUserStore()
  const { recommendation, checkin, isGenerating, setRecommendation, setCheckin, setGenerating } = useCoachStore()

  useEffect(() => {
    if (!user) return
    fetch('/api/checkin').then(r => r.json()).then(data => setCheckin(data)).catch(() => {})
    fetch('/api/coach').then(r => r.json()).then(data => setRecommendation(data)).catch(() => {})
  }, [user, setCheckin, setRecommendation])

  const generateAdvice = useCallback(async () => {
    if (!user || isGenerating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/coach', { method: 'POST' })
      const data = await res.json()
      if (data && !data.error) setRecommendation(data)
    } catch (error) {
      console.error('Generate advice error:', error)
    } finally {
      setGenerating(false)
    }
  }, [user, isGenerating, setGenerating, setRecommendation])

  const saveCheckin = useCallback(async (checkinData: {
    feeling_score: number
    energy_score: number
    stress_score?: number
    motivation_score?: number
    soreness_score?: number
    sleep_quality?: number
    has_pain: boolean
    pain_description?: string
    notes?: string
  }) => {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkinData),
    })
    if (!res.ok) throw new Error('Check-in opslaan mislukt')
    const data = await res.json()
    setCheckin(data)
    return data
  }, [setCheckin])

  return { recommendation, checkin, isGenerating, generateAdvice, saveCheckin, hasCheckin: !!checkin }
}
