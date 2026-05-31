import { defaultAI } from './providers'
import { calculateRecoveryScore } from './recovery-engine'
import { buildDailyCoachPrompt } from '../prompts/daily-coach'
import { profileService } from '@/services/profile'
import { checkinService } from '@/services/checkin'
import { coachService } from '@/services/coach'
import { supabase } from '@/services/supabase'
import { CoachRecommendation } from '@/types'

export const coachEngine = {
  async generateDailyAdvice(userId: string): Promise<CoachRecommendation> {
    // Check cache first
    const existing = await coachService.getTodayRecommendation(userId)
    if (existing) return existing

    // Gather all context
    const [profile, goals, checkin, memory] = await Promise.all([
      profileService.getProfile(userId),
      profileService.getGoals(userId),
      checkinService.getTodayCheckin(userId),
      coachService.getMemory(userId),
    ])

    // Get today's health metrics
    const today = new Date().toISOString().split('T')[0]
    const { data: metrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (!profile) throw new Error('Profiel niet gevonden')

    // Calculate recovery
    const recovery = calculateRecoveryScore(checkin, metrics)

    // Save daily status
    await coachService.saveDailyStatus(userId, {
      recovery_score: recovery.score,
      energy_score: checkin?.energy_score ? checkin.energy_score * 10 : null,
      status_color: recovery.color,
    })

    // Build prompt
    const systemPrompt = buildDailyCoachPrompt(profile, goals, checkin, metrics, recovery, memory)

    // Call AI
    const response = await defaultAI.generateResponse(
      [{ role: 'user', content: 'Geef mijn coaching advies voor vandaag.' }],
      systemPrompt
    )

    // Parse response
    let parsed: { recommendation: string; reasoning: string; recovery_status: string; energy_level: number }
    try {
      const clean = response.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = {
        recommendation: 'Een rustige wandeling van 30 minuten',
        reasoning: response,
        recovery_status: recovery.status,
        energy_level: checkin?.energy_score || 5,
      }
    }

    // Save recommendation
    const recommendation = await coachService.saveRecommendation(userId, {
      recommendation: parsed.recommendation,
      reasoning: parsed.reasoning,
      recovery_status: parsed.recovery_status,
      energy_level: parsed.energy_level,
    })

    // Save conversation
    await coachService.saveConversation(userId, 'assistant', parsed.recommendation)

    return recommendation
  },
}
