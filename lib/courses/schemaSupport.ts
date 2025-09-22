import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

let cachedCourseLocationSupport: boolean | null = null
let cachedCourseScheduleSupport: boolean | null = null
let cachedCourseDescriptionSupport: boolean | null = null

export function resetCourseSchemaSupportCache() {
  cachedCourseLocationSupport = null
  cachedCourseScheduleSupport = null
  cachedCourseDescriptionSupport = null
}

export async function hasAdvancedCourseLocationColumns(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  if (cachedCourseLocationSupport !== null) {
    return cachedCourseLocationSupport
  }

  const { error } = await supabase.from('courses').select('location_latitude').limit(1)

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        'Courses table lacks advanced location columns, falling back to classroom_location JSON:',
        error.message
      )
    }
    cachedCourseLocationSupport = false
    return false
  }

  cachedCourseLocationSupport = true
  return true
}

export async function hasCourseScheduleColumn(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  if (cachedCourseScheduleSupport !== null) {
    return cachedCourseScheduleSupport
  }

  const { error } = await supabase.from('courses').select('schedule').limit(1)

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('Courses table lacks schedule column, using empty schedule fallback:', error.message)
    }
    cachedCourseScheduleSupport = false
    return false
  }

  cachedCourseScheduleSupport = true
  return true
}

export async function hasCourseDescriptionColumn(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  if (cachedCourseDescriptionSupport !== null) {
    return cachedCourseDescriptionSupport
  }

  const { error } = await supabase.from('courses').select('description').limit(1)

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('Courses table lacks description column, skipping optional description field:', error.message)
    }
    cachedCourseDescriptionSupport = false
    return false
  }

  cachedCourseDescriptionSupport = true
  return true
}
