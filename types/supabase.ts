export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      students: {
        Row: {
          student_id: string
          name: string
          password_hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          student_id: string
          name: string
          password_hash: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          student_id?: string
          name?: string
          password_hash?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      professors: {
        Row: {
          professor_id: string
          name: string
          email: string | null
          password_hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          professor_id: string
          name: string
          email?: string | null
          password_hash: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          professor_id?: string
          name?: string
          email?: string | null
          password_hash?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          name: string
          course_code: string
          professor_id: string
          description: string | null
          schedule: string | null
          location: string | null
          location_latitude: number | null
          location_longitude: number | null
          location_radius: number | null
          created_at: string
          updated_at: string
          classroom_location?: Json | null
        }
        Insert: {
          id?: string
          name: string
          course_code: string
          professor_id: string
          description?: string | null
          schedule?: string | null
          location?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_radius?: number | null
          created_at?: string
          updated_at?: string
          classroom_location?: Json | null
        }
        Update: {
          id?: string
          name?: string
          course_code?: string
          professor_id?: string
          description?: string | null
          schedule?: string | null
          location?: string | null
          location_latitude?: number | null
          location_longitude?: number | null
          location_radius?: number | null
          created_at?: string
          updated_at?: string
          classroom_location?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'courses_professor_id_fkey'
            columns: ['professor_id']
            isOneToOne: false
            referencedRelation: 'professors'
            referencedColumns: ['professor_id']
          }
        ]
      }
      class_sessions: {
        Row: {
          id: string
          course_id: string | null
          date: string
          qr_code: string
          qr_code_expires_at: string
          status: string
          created_at: string
          updated_at: string
          start_time: string | null
          end_time: string | null
          is_active: boolean | null
          classroom_latitude: number | null
          classroom_longitude: number | null
          classroom_radius: number | null
        }
        Insert: {
          id?: string
          course_id?: string | null
          date: string
          qr_code: string
          qr_code_expires_at: string
          status?: string
          created_at?: string
          updated_at?: string
          start_time?: string | null
          end_time?: string | null
          is_active?: boolean | null
          classroom_latitude?: number | null
          classroom_longitude?: number | null
          classroom_radius?: number | null
        }
        Update: {
          id?: string
          course_id?: string | null
          date?: string
          qr_code?: string
          qr_code_expires_at?: string
          status?: string
          created_at?: string
          updated_at?: string
          start_time?: string | null
          end_time?: string | null
          is_active?: boolean | null
          classroom_latitude?: number | null
          classroom_longitude?: number | null
          classroom_radius?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'class_sessions_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          }
        ]
      }
      attendances: {
        Row: {
          id: string
          session_id: string
          student_id: string
          status: string
          check_in_time: string | null
          check_out_time: string | null
          location_verified: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          student_id: string
          status?: string
          check_in_time?: string | null
          check_out_time?: string | null
          location_verified?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          student_id?: string
          status?: string
          check_in_time?: string | null
          check_out_time?: string | null
          location_verified?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attendances_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'class_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendances_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['student_id']
          }
        ]
      }
      location_logs: {
        Row: {
          id: string
          attendance_id: string
          latitude: number
          longitude: number
          accuracy: number
          timestamp: string
          is_valid: boolean | null
        }
        Insert: {
          id?: string
          attendance_id: string
          latitude: number
          longitude: number
          accuracy: number
          timestamp?: string
          is_valid?: boolean | null
        }
        Update: {
          id?: string
          attendance_id?: string
          latitude?: number
          longitude?: number
          accuracy?: number
          timestamp?: string
          is_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'location_logs_attendance_id_fkey'
            columns: ['attendance_id']
            isOneToOne: false
            referencedRelation: 'attendances'
            referencedColumns: ['id']
          }
        ]
      }
      course_enrollments: {
        Row: {
          id: string
          course_id: string
          student_id: string
          enrolled_at: string
        }
        Insert: {
          id?: string
          course_id: string
          student_id: string
          enrolled_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          student_id?: string
          enrolled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'course_enrollments_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'course_enrollments_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['student_id']
          }
        ]
      }
      predefined_locations: {
        Row: {
          id: string
          building_name: string
          room_number: string | null
          display_name: string
          latitude: number | null
          longitude: number | null
          radius: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          building_name: string
          room_number?: string | null
          display_name: string
          latitude?: number | null
          longitude?: number | null
          radius?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          building_name?: string
          room_number?: string | null
          display_name?: string
          latitude?: number | null
          longitude?: number | null
          radius?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
