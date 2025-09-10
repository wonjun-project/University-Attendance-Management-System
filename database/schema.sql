-- 대학 출결관리시스템 데이터베이스 스키마
-- 생성일: 2024-09-08

-- 사용자 테이블 (학생, 교수)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) UNIQUE, -- 학번 (학생인 경우에만)
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'professor')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 강의 테이블
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL, -- 강의코드 (예: CS101)
    name VARCHAR(200) NOT NULL, -- 강의명
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester VARCHAR(20) NOT NULL, -- 학기 (예: 2024-2)
    room VARCHAR(100), -- 강의실
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=월요일, 7=일요일
    start_time TIME NOT NULL, -- 수업 시작 시간
    end_time TIME NOT NULL, -- 수업 종료 시간
    gps_latitude DECIMAL(10, 8), -- 강의실 GPS 위도
    gps_longitude DECIMAL(11, 8), -- 강의실 GPS 경도
    gps_radius INTEGER DEFAULT 50, -- 허용 반경 (미터)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 수강신청 테이블 (학생-강의 연결)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- 출석 세션 테이블 (개별 수업 세션)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    qr_code VARCHAR(500), -- QR 코드 데이터
    auth_code VARCHAR(10), -- 2차 인증 코드
    qr_expires_at TIMESTAMP WITH TIME ZONE, -- QR 코드 만료 시간
    auth_expires_at TIMESTAMP WITH TIME ZONE, -- 인증 코드 만료 시간
    is_active BOOLEAN DEFAULT false, -- 세션 활성화 상태
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, session_date)
);

-- 출석 기록 테이블
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    qr_scanned_at TIMESTAMP WITH TIME ZONE, -- QR 스캔 시간
    gps_verified_at TIMESTAMP WITH TIME ZONE, -- GPS 인증 시간
    auth_verified_at TIMESTAMP WITH TIME ZONE, -- 2차 인증 시간
    gps_latitude DECIMAL(10, 8), -- 학생이 출석체크한 GPS 위도
    gps_longitude DECIMAL(11, 8), -- 학생이 출석체크한 GPS 경도
    ip_address INET, -- 접속 IP 주소
    user_agent TEXT, -- 브라우저 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- 시스템 로그 테이블 (보안 및 디버깅용)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_courses_professor_id ON courses(professor_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_attendance_sessions_course_id ON attendance_sessions(course_id);
CREATE INDEX idx_attendance_sessions_date ON attendance_sessions(session_date);
CREATE INDEX idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX idx_system_logs_action ON system_logs(action);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
-- 사용자는 자신의 정보만 조회/수정 가능
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 교수는 자신의 강의만 관리 가능
CREATE POLICY "Professors can manage own courses" ON courses
    FOR ALL USING (auth.uid() = professor_id);

-- 학생은 수강 중인 강의만 조회 가능
CREATE POLICY "Students can view enrolled courses" ON courses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM enrollments 
            WHERE enrollments.course_id = courses.id 
            AND enrollments.student_id = auth.uid()
        )
    );

-- 수강신청 정보 접근 제한
CREATE POLICY "Students can view own enrollments" ON enrollments
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Professors can view course enrollments" ON enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = enrollments.course_id 
            AND courses.professor_id = auth.uid()
        )
    );

-- 출석 세션 접근 제한
CREATE POLICY "Professors can manage own sessions" ON attendance_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = attendance_sessions.course_id 
            AND courses.professor_id = auth.uid()
        )
    );

CREATE POLICY "Students can view active sessions" ON attendance_sessions
    FOR SELECT USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM courses 
            JOIN enrollments ON courses.id = enrollments.course_id
            WHERE courses.id = attendance_sessions.course_id 
            AND enrollments.student_id = auth.uid()
        )
    );

-- 출석 기록 접근 제한
CREATE POLICY "Students can manage own attendance" ON attendance_records
    FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Professors can view course attendance" ON attendance_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM attendance_sessions 
            JOIN courses ON attendance_sessions.course_id = courses.id
            WHERE attendance_sessions.id = attendance_records.session_id 
            AND courses.professor_id = auth.uid()
        )
    );

-- 시스템 로그는 관리자와 해당 사용자만 조회 가능
CREATE POLICY "Users can view own logs" ON system_logs
    FOR SELECT USING (auth.uid() = user_id);