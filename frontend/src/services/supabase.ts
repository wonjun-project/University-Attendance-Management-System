import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경변수 검증
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('REACT_APP_SUPABASE_URL 환경변수가 설정되지 않았습니다.');
}

if (!supabaseAnonKey) {
  throw new Error('REACT_APP_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.');
}

// Supabase 클라이언트 생성 (클라이언트 사이드용)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// 데이터베이스 타입 정의
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'professor';
  student_id?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  course_code: string;
  name: string;
  professor_id: string;
  semester: string;
  room?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_radius?: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  session_date: string;
  qr_code?: string;
  auth_code?: string;
  qr_expires_at?: string;
  auth_expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'late' | 'absent';
  qr_scanned_at?: string;
  gps_verified_at?: string;
  auth_verified_at?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}