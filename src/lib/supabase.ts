import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client - alleen voor auth state in React componenten
export const browserClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// Admin client - alleen in API routes (server-side)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
