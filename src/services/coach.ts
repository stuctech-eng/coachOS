import { supabase } from './supabase'
import { CoachRecommendation, CoachMemory, CoachInsight, DailyStatus } from '@/types'

export const coachService = {
  async getTodayRecommendation(userId: string): Promise<CoachRecommendation | null> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('coach_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    return data
  },

  async saveRecommendation(userId: string, rec: Partial<CoachRecommendation>): Promise<CoachRecommendation> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('coach_recommendations')
      .upsert({ user_id: userId, date: today, ...rec })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getMemory(userId: string): Promise<CoachMemory[]> {
    const { data } = await supabase
      .from('coach_memory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    return data || []
  },

  async addMemory(userId: string, memory: Partial<CoachMemory>): Promise<void> {
    await supabase.from('coach_memory').insert({ user_id: userId, ...memory })
  },

  async getInsights(userId: string): Promise<CoachInsight[]> {
    const { data } = await supabase
      .from('coach_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('confidence', { ascending: false })
    return data || []
  },

  async getTodayStatus(userId: string): Promise<DailyStatus | null> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('daily_status')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    return data
  },

  async saveDailyStatus(userId: string, status: Partial<DailyStatus>): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    await supabase
      .from('daily_status')
      .upsert({ user_id: userId, date: today, ...status })
  },

  async saveConversation(userId: string, role: 'user' | 'assistant', message: string): Promise<void> {
    await supabase.from('ai_conversations').insert({
      user_id: userId,
      role,
      message,
    })
  },
}
