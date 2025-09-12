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
      attendances: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          id: string
          location_verified: boolean | null
          session_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          location_verified?: boolean | null
          session_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          location_verified?: boolean | null
          session_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          course_id: string
          created_at: string
          date: string
          id: string
          qr_code: string
          qr_code_expires_at: string
          status: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          date: string
          id?: string
          qr_code: string
          qr_code_expires_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          date?: string
          id?: string
          qr_code?: string
          qr_code_expires_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          classroom_location: Json
          course_code: string
          created_at: string
          id: string
          name: string
          professor_id: string
          schedule: Json
          updated_at: string
        }
        Insert: {
          classroom_location: Json
          course_code: string
          created_at?: string
          id?: string
          name: string
          professor_id: string
          schedule: Json
          updated_at?: string
        }
        Update: {
          classroom_location?: Json
          course_code?: string
          created_at?: string
          id?: string
          name?: string
          professor_id?: string
          schedule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      location_logs: {
        Row: {
          accuracy: number
          attendance_id: string
          id: string
          is_valid: boolean | null
          latitude: number
          longitude: number
          timestamp: string
        }
        Insert: {
          accuracy: number
          attendance_id: string
          id?: string
          is_valid?: boolean | null
          latitude: number
          longitude: number
          timestamp?: string
        }
        Update: {
          accuracy?: number
          attendance_id?: string
          id?: string
          is_valid?: boolean | null
          latitude?: number
          longitude?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_logs_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_distance: {
        Args: {
          lat1: number
          lon1: number
          lat2: number
          lon2: number
        }
        Returns: number
      }
      check_in_attendance: {
        Args: {
          p_session_id: string
          p_student_id: string
          p_latitude: number
          p_longitude: number
          p_accuracy: number
        }
        Returns: Json
      }
      generate_qr_code: {
        Args: {
          p_course_id: string
          p_date: string
          p_expires_in_minutes?: number
        }
        Returns: string
      }
      track_student_location: {
        Args: {
          p_attendance_id: string
          p_latitude: number
          p_longitude: number
          p_accuracy: number
        }
        Returns: Json
      }
      validate_student_location: {
        Args: {
          p_student_lat: number
          p_student_lon: number
          p_classroom_location: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}