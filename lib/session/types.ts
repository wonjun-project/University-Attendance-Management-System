import type { Database } from '@/types/supabase'

export type SupabaseCourseRow = Database['public']['Tables']['courses']['Row']
export type SupabaseSessionRow = Database['public']['Tables']['class_sessions']['Row'] & {
  courses: SupabaseCourseRow | SupabaseCourseRow[] | null
}
