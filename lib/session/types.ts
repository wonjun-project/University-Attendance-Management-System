export type SessionStatus = 'scheduled' | 'active' | 'ended'

export interface SupabaseCourseRow {
  id: string
  name: string | null
  course_code: string | null
  classroom_location: unknown
}

export interface SupabaseSessionRow {
  id: string
  course_id: string | null
  created_at: string | null
  updated_at: string | null
  date: string | null
  qr_code: string | null
  qr_code_expires_at: string
  status: SessionStatus
  classroom_latitude: number | null
  classroom_longitude: number | null
  classroom_radius: number | null
  classroom_location_type?: 'predefined' | 'current' | null
  predefined_location_id?: string | null
  classroom_display_name?: string | null
  courses: SupabaseCourseRow | SupabaseCourseRow[] | null
}
