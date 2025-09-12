// User types
export interface User {
  id: string
  email: string
  student_id?: string
  name: string
  role: 'student' | 'professor'
  created_at: string
  updated_at: string
}

// Course types
export interface Course {
  id: string
  name: string
  course_code: string
  professor_id: string
  classroom_location: {
    latitude: number
    longitude: number
    radius: number // meters
  }
  schedule: {
    day_of_week: number // 0=Sunday, 1=Monday, etc.
    start_time: string // HH:MM format
    end_time: string
  }[]
  created_at: string
  updated_at: string
}

// Class Session types
export interface ClassSession {
  id: string
  course_id: string
  date: string
  qr_code: string
  qr_code_expires_at: string
  status: 'scheduled' | 'active' | 'ended'
  created_at: string
  updated_at: string
}

// Attendance types
export interface Attendance {
  id: string
  session_id: string
  student_id: string
  status: 'present' | 'absent' | 'late' | 'left_early'
  check_in_time?: string
  check_out_time?: string
  location_verified: boolean
  location_logs: LocationLog[]
  created_at: string
  updated_at: string
}

// Location Log types
export interface LocationLog {
  id: string
  attendance_id: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
  is_valid: boolean
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Auth types
export interface AuthUser {
  id: string
  email?: string | null
  role: 'student' | 'professor'
  student_id?: string | null
  professor_id?: string | null
  name: string
}

// GPS types
export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy: number
}

// QR Code types
export interface QRCodeData {
  session_id: string
  course_id: string
  expires_at: string
}