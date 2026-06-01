import { createAdminClient } from './supabase'
import { Profile, UserGoal, OnboardingData } from '@/types'

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error) return null
    return data
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async completeOnboarding(userId: string, onboardingData: OnboardingData): Promise<void> {
    const supabase = createAdminClient()
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: onboardingData.first_name,
        display_name: onboardingData.display_name,
        age: onboardingData.age,
        gender: onboardingData.gender,
        available_time: onboardingData.available_time,
        onboarding_completed: true,
      })
      .eq('user_id', userId)
    if (profileError) throw profileError

    if (onboardingData.goals.length > 0) {
      const goals = onboardingData.goals.map((goalType, index) => ({
        user_id: userId,
        goal_type: goalType,
        title: goalType,
        priority: index + 1,
        status: 'active' as const,
      }))
      await supabase.from('user_goals').insert(goals)
    }

    if (onboardingData.activities.length > 0) {
      const { data: templates } = await supabase
        .from('activity_templates')
        .select('id, name')
        .in('name', onboardingData.activities)

      if (templates && templates.length > 0) {
        const activities = templates.map((t) => ({
          user_id: userId,
          template_id: t.id,
          name: t.name,
        }))
        await supabase.from('activities').insert(activities)
      }
    }
  },

  async getGoals(userId: string): Promise<UserGoal[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority')
    if (error) return []
    return data
  },
}
