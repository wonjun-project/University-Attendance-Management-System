--- 대학 출결관리시스템 완전한 데이터베이스 스키마
-- 생성일: 2024-09-10
-- 설명: 모든 테이블, 인덱스, 트리거, RLS 정책, 함수를 포함한 완전한 스키마

-- ===============================================
-- 1. 테이블 생성
-- ===============================================

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
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), -- 1=월요일, 7=일요일 (nullable)
    start_time TIME, -- 수업 시작 시간 (nullable)
    end_time TIME, -- 수업 종료 시간 (nullable)
    schedule VARCHAR(200), -- 스케줄 정보
    description TEXT, -- 강의 설명
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
    manual_override BOOLEAN DEFAULT FALSE, -- 수동 출석 처리 여부
    manual_reason TEXT, -- 수동 처리 사유
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

-- ===============================================
-- 2. 인덱스 생성 (성능 최적화)
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course_id ON attendance_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_manual_override ON attendance_records(manual_override);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_courses_description ON courses USING gin(to_tsvector('english', description));

-- ===============================================
-- 3. 트리거 함수 및 트리거 (updated_at 자동 업데이트)
-- ===============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_sessions_updated_at ON attendance_sessions;
CREATE TRIGGER update_attendance_sessions_updated_at BEFORE UPDATE ON attendance_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- 4. 출석 통계 뷰 생성 (성능 최적화용)
-- ===============================================

CREATE OR REPLACE VIEW attendance_stats_view AS
SELECT 
    c.id as course_id,
    c.name as course_name,
    c.course_code,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(ar.id) as total_records,
    COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count,
    COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
    ROUND(
        CASE 
            WHEN COUNT(ar.id) > 0 
            THEN (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END) * 100.0 / COUNT(ar.id))
            ELSE 0 
        END, 1
    ) as attendance_rate
FROM courses c
LEFT JOIN attendance_sessions s ON c.id = s.course_id
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN attendance_records ar ON s.id = ar.session_id
GROUP BY c.id, c.name, c.course_code;

-- ===============================================
-- 5. 출석률 계산 함수
-- ===============================================

CREATE OR REPLACE FUNCTION calculate_attendance_rate(
    p_course_id UUID DEFAULT NULL,
    p_student_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    total_sessions INTEGER;
    attended_sessions INTEGER;
    rate NUMERIC;
BEGIN
    -- 전체 세션 수 계산
    SELECT COUNT(DISTINCT s.id) INTO total_sessions
    FROM attendance_sessions s
    WHERE (p_course_id IS NULL OR s.course_id = p_course_id);
    
    -- 출석한 세션 수 계산 (출석 + 지각)
    SELECT COUNT(DISTINCT ar.session_id) INTO attended_sessions
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE ar.status IN ('present', 'late')
    AND (p_course_id IS NULL OR s.course_id = p_course_id)
    AND (p_student_id IS NULL OR ar.student_id = p_student_id);
    
    -- 출석률 계산
    IF total_sessions > 0 THEN
        rate := ROUND((attended_sessions * 100.0 / total_sessions), 1);
    ELSE
        rate := 0;
    END IF;
    
    RETURN rate;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 6. Row Level Security (RLS) 활성화
-- ===============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- 7. RLS 정책 생성
-- ===============================================

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Professors can manage own courses" ON courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON courses;
DROP POLICY IF EXISTS "Students can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Professors can view course enrollments" ON enrollments;
DROP POLICY IF EXISTS "Professors can manage own sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Students can view active sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Students can manage own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Professors can view course attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can view own logs" ON system_logs;

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

-- ===============================================
-- 8. 테이블 및 함수 설명 추가
-- ===============================================

COMMENT ON TABLE users IS '사용자 테이블 - 학생과 교수 정보 저장';
COMMENT ON TABLE courses IS '강의 테이블 - 강의 정보 및 GPS 위치 저장';
COMMENT ON TABLE enrollments IS '수강신청 테이블 - 학생과 강의 연결';
COMMENT ON TABLE attendance_sessions IS '출석 세션 테이블 - 개별 수업 세션 정보';
COMMENT ON TABLE attendance_records IS '출석 기록 테이블 - 학생별 출석 기록';
COMMENT ON TABLE system_logs IS '시스템 로그 테이블 - 보안 및 감사용';

COMMENT ON FUNCTION calculate_attendance_rate IS '출석률 계산 함수 - 과목별 또는 학생별 출석률을 계산합니다';
COMMENT ON VIEW attendance_stats_view IS '출석 통계 뷰 - 과목별 출석 통계를 빠르게 조회할 수 있습니다';

COMMENT ON COLUMN attendance_records.manual_override IS '수동 출석 처리 여부';
COMMENT ON COLUMN attendance_records.manual_reason IS '수동 처리 사유';
COMMENT ON COLUMN courses.description IS '강의 설명';
COMMENT ON COLUMN courses.schedule IS '강의 스케줄 정보';

-- ===============================================
-- 9. 데모 데이터 삽입 (선택사항)
-- ===============================================

-- 교수 계정 생성 (비밀번호: password123)
INSERT INTO users (email, password_hash, name, role, phone) 
VALUES (
    'professor1@university.ac.kr',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/xREHWMEEPCd1ZaF7y', -- password123
    '김교수',
    'professor',
    '010-1234-5678'
) ON CONFLICT (email) DO NOTHING;

-- 학생 계정 생성 (비밀번호: password123)
INSERT INTO users (email, password_hash, name, student_id, role, phone) 
VALUES (
    'student1@university.ac.kr',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/xREHWMEEPCd1ZaF7y', -- password123
    '홍학생',
    '2024001234',
    'student',
    '010-9876-5432'
) ON CONFLICT (email) DO NOTHING;

-- ===============================================
-- 완료 메시지
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 데이터베이스 스키마가 성공적으로 생성되었습니다!';
    RAISE NOTICE '📊 생성된 테이블: users, courses, enrollments, attendance_sessions, attendance_records, system_logs';
    RAISE NOTICE '🔍 생성된 뷰: attendance_stats_view';
    RAISE NOTICE '⚡ 생성된 함수: calculate_attendance_rate, update_updated_at_column';
    RAISE NOTICE '🔒 RLS 정책이 모든 테이블에 적용되었습니다';
    RAISE NOTICE '👥 데모 계정 생성: professor1@university.ac.kr, student1@university.ac.kr (비밀번호: password123)';
END $$;