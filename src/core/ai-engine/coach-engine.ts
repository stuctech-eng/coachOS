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
    if (existing?.recommendation) return existing

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

    console.log('AI raw response:', response)

    // Parse response - meerdere strategieën
    let recommendation = 'Een rustige wandeling van 30 minuten'
    let reasoning = 'Op basis van je huidige herstelstatus is een lichte activiteit het beste voor vandaag.'

    try {
      // Strategie 1: directe JSON parse
      const clean = response.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (parsed.recommendation) recommendation = parsed.recommendation
      if (parsed.reasoning) reasoning = parsed.reasoning
    } catch {
      try {
        // Strategie 2: JSON uit tekst extraheren
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.recommendation) recommendation = parsed.recommendation
          if (parsed.reasoning) reasoning = parsed.reasoning
        } else {
          // Strategie 3: gebruik de volledige response als reasoning
          reasoning = response
        }
      } catch {
        reasoning = response
      }
    }

    // Verwijder eventuele lege strings
    if (!recommendation || recommendation.trim() === '') {
      recommendation = 'Een rustige wandeling van 30 minuten'
    }
    if (!reasoning || reasoning.trim() === '') {
      reasoning = 'Op basis van je herstelstatus is rust of lichte beweging het beste voor vandaag.'
    }

    // Save recommendation
    const saved = await coachService.saveRecommendation(userId, {
      recommendation,
      reasoning,
      recovery_status: recovery.status,
      energy_level: checkin?.energy_score || 5,
    })

    // Save conversation
    await coachService.saveConversation(userId, 'assistant', recommendation)

    return saved
  },
}
