-- 데이터베이스 스키마 업데이트
-- 수동 출석 처리 및 추가 기능을 위한 컬럼 추가

-- 출석 기록 테이블에 수동 처리 관련 컬럼 추가
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manual_reason TEXT;

-- 강의 테이블에 설명 및 스케줄 컬럼 추가  
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS schedule VARCHAR(200);

-- 강의 테이블의 day_of_week, start_time, end_time 컬럼을 nullable로 변경 (schedule로 대체)
ALTER TABLE courses
ALTER COLUMN day_of_week DROP NOT NULL,
ALTER COLUMN start_time DROP NOT NULL,
ALTER COLUMN end_time DROP NOT NULL;

-- 출석 세션 테이블에 만료 시간 관련 컬럼 추가 (기존에 없다면)
ALTER TABLE attendance_sessions 
ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auth_expires_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_attendance_records_manual_override ON attendance_records(manual_override);
CREATE INDEX IF NOT EXISTS idx_courses_description ON courses USING gin(to_tsvector('english', description));

-- 뷰 생성: 출석 통계 뷰 (성능 최적화용)
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

-- 함수: 출석률 계산 함수
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

COMMENT ON FUNCTION calculate_attendance_rate IS '출석률 계산 함수 - 과목별 또는 학생별 출석률을 계산합니다';
COMMENT ON VIEW attendance_stats_view IS '출석 통계 뷰 - 과목별 출석 통계를 빠르게 조회할 수 있습니다';
COMMENT ON COLUMN attendance_records.manual_override IS '수동 출석 처리 여부';
COMMENT ON COLUMN attendance_records.manual_reason IS '수동 처리 사유';