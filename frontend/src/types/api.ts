// API 응답 및 데이터 타입 정의

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
    statusCode: number;
  };
  message?: string;
  timestamp: string;
}

// 사용자 관련 타입
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

// 강의 관련 타입
export interface Course {
  id: string;
  course_code: string;
  name: string;
  professor_id: string;
  semester: string;
  room?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  schedule?: string;
  description?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_radius?: number;
  created_at: string;
  updated_at: string;
  professor?: User;
  _count?: {
    enrollments: number;
    attendance_sessions: number;
  };
}

// 출석 관련 타입
export interface AttendanceSession {
  id: string;
  course_id: string;
  session_date: string;
  qr_code?: string;
  auth_code: string;
  is_active: boolean;
  qr_expires_at?: string;
  auth_expires_at?: string;
  created_at: string;
  updated_at: string;
  courses: Course;
  attendance_records?: AttendanceRecord[];
  attendanceStats?: {
    totalStudents: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
  };
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
  manual_override?: boolean;
  manual_reason?: string;
  created_at: string;
  updated_at: string;
  users?: User;
  attendance_sessions?: AttendanceSession;
}

// 수강신청 관련 타입
export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  students: User;
  courses: Course;
}

// 통계 관련 타입
export interface AttendanceStats {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
}

export interface StudentStats extends AttendanceStats {
  studentInfo: User;
}

export interface CourseAttendanceStats {
  courseInfo: Course;
  overallStats: AttendanceStats & {
    totalStudents: number;
    totalRecords: number;
  };
  studentStats: StudentStats[];
  sessionStats: Array<{
    sessionId: string;
    sessionDate: string;
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
  }>;
}

// GPS 관련 타입
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  distance: number;
  allowedRadius: number;
  accuracy?: number;
  error?: string;
}

// 시스템 로그 타입
export interface SystemLog {
  id: string;
  user_id?: string;
  action: string;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
  users?: User;
}

// 페이지네이션 타입
export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  currentPage?: number;
  totalPages?: number;
}

// API 요청 타입들
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: 'student' | 'professor';
  student_id?: string;
  phone?: string;
}

export interface CreateCourseData {
  course_code: string;
  name: string;
  semester: string;
  room?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  schedule?: string;
  description?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_radius?: number;
}

export interface CreateSessionData {
  course_id: string;
  session_date: string;
  auth_code?: string;
}

export interface QRGenerationOptions {
  width?: number;
  height?: number;
}

export interface ManualAttendanceData {
  sessionId: string;
  studentId: string;
  status: 'present' | 'late' | 'absent';
  reason?: string;
}

// 필터 및 쿼리 타입들
export interface AttendanceRecordsQuery {
  courseId?: string;
  limit?: number;
  offset?: number;
  dateRange?: [string, string];
}

export interface SessionsQuery extends AttendanceRecordsQuery {
  isActive?: boolean;
}

// 에러 타입
export interface ApiError {
  message: string;
  statusCode: number;
  details?: any;
}

// 응답 타입 헬퍼
export type ApiResponseWrapper<T> = Promise<T>;
export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};