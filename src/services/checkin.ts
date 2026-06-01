import { createAdminClient } from './supabase'
import { DailyCheckin } from '@/types'

export const checkinService = {
  async getTodayCheckin(userId: string): Promise<DailyCheckin | null> {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    if (error) return null
    return data
  },

  async saveCheckin(userId: string, checkin: Partial<DailyCheckin>): Promise<DailyCheckin> {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('daily_checkins')
      .upsert({
        user_id: userId,
        date: today,
        ...checkin,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async getRecentCheckins(userId: string, days = 7): Promise<DailyCheckin[]> {
    const supabase = createAdminClient()
    const from = new Date()
    from.setDate(from.getDate() - days)
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from.toISOString().split('T')[0])
      .order('date', { ascending: false })
    if (error) return []
    return data
  },
}
