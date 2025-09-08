-- 초기 테스트 데이터
-- 실행 순서: schema.sql 실행 후 이 파일 실행

-- 테스트용 사용자 생성 (비밀번호는 모두 'password123')
-- 비밀번호 해시는 bcrypt로 생성됨: $2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq
INSERT INTO users (id, email, password_hash, name, student_id, role, phone) VALUES
-- 교수 계정
('550e8400-e29b-41d4-a716-446655440001', 'professor1@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '김교수', NULL, 'professor', '010-1234-5678'),
('550e8400-e29b-41d4-a716-446655440002', 'professor2@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '이교수', NULL, 'professor', '010-2345-6789'),

-- 학생 계정
('550e8400-e29b-41d4-a716-446655440003', 'student1@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '홍길동', '2024001', 'student', '010-3456-7890'),
('550e8400-e29b-41d4-a716-446655440004', 'student2@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '김영희', '2024002', 'student', '010-4567-8901'),
('550e8400-e29b-41d4-a716-446655440005', 'student3@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '박철수', '2024003', 'student', '010-5678-9012'),
('550e8400-e29b-41d4-a716-446655440006', 'student4@university.ac.kr', '$2b$10$8jHXBCTJNO4hZ7HhZW7Pu.vY8QqFTwv7IaHOYF1qGxJ8JsKIB4GZq', '최민수', '2024004', 'student', '010-6789-0123');

-- 테스트용 강의 생성
INSERT INTO courses (id, course_code, name, professor_id, semester, room, day_of_week, start_time, end_time, gps_latitude, gps_longitude, gps_radius) VALUES
-- 컴퓨터과학과 강의들
('660e8400-e29b-41d4-a716-446655440001', 'CS101', '컴퓨터과학개론', '550e8400-e29b-41d4-a716-446655440001', '2024-2', '공학관 301호', 2, '09:00', '10:30', 37.2796, 127.0447, 50),
('660e8400-e29b-41d4-a716-446655440002', 'CS201', '자료구조', '550e8400-e29b-41d4-a716-446655440001', '2024-2', '공학관 302호', 3, '10:45', '12:15', 37.2797, 127.0448, 50),
('660e8400-e29b-41d4-a716-446655440003', 'CS301', '데이터베이스', '550e8400-e29b-41d4-a716-446655440002', '2024-2', '공학관 303호', 4, '13:30', '15:00', 37.2798, 127.0449, 50),
('660e8400-e29b-41d4-a716-446655440004', 'CS401', '소프트웨어공학', '550e8400-e29b-41d4-a716-446655440002', '2024-2', '공학관 304호', 5, '15:15', '16:45', 37.2799, 127.0450, 50);

-- 수강신청 데이터
INSERT INTO enrollments (student_id, course_id) VALUES
-- 홍길동 (student1) 수강신청
('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001'), -- CS101
('550e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002'), -- CS201

-- 김영희 (student2) 수강신청
('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001'), -- CS101
('550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440003'), -- CS301

-- 박철수 (student3) 수강신청
('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002'), -- CS201
('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440003'), -- CS301
('550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440004'), -- CS401

-- 최민수 (student4) 수강신청
('550e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440001'), -- CS101
('550e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440004'); -- CS401

-- 테스트용 출석 세션 (오늘 날짜 기준)
INSERT INTO attendance_sessions (id, course_id, session_date, qr_code, auth_code, qr_expires_at, auth_expires_at, is_active) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', CURRENT_DATE, 'test-qr-code-cs101', '1234', NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '60 minutes', true),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', CURRENT_DATE, 'test-qr-code-cs201', '5678', NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '60 minutes', false);

-- 테스트용 출석 기록
INSERT INTO attendance_records (session_id, student_id, status, qr_scanned_at, gps_verified_at, auth_verified_at, gps_latitude, gps_longitude) VALUES
-- CS101 출석 기록
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'present', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '8 minutes', 37.2796, 127.0447),
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'late', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '3 minutes', 37.2796, 127.0447),

-- CS201 출석 기록  
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'present', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '13 minutes', 37.2797, 127.0448);

-- 시스템 로그 샘플
INSERT INTO system_logs (user_id, action, description, metadata) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'LOGIN', '학생 로그인', '{"ip": "192.168.1.100", "browser": "Chrome"}'),
('550e8400-e29b-41d4-a716-446655440001', 'CREATE_SESSION', 'QR 세션 생성', '{"course_id": "660e8400-e29b-41d4-a716-446655440001", "session_date": "2024-09-08"}'),
('550e8400-e29b-41d4-a716-446655440003', 'SCAN_QR', 'QR 코드 스캔', '{"session_id": "770e8400-e29b-41d4-a716-446655440001", "success": true}');

-- 뷰 생성 (출석률 계산용)
CREATE OR REPLACE VIEW attendance_statistics AS
SELECT 
    c.id as course_id,
    c.name as course_name,
    c.professor_id,
    u.name as professor_name,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT ar.id) as total_records,
    COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) as present_count,
    COUNT(DISTINCT CASE WHEN ar.status = 'late' THEN ar.id END) as late_count,
    COUNT(DISTINCT CASE WHEN ar.status = 'absent' THEN ar.id END) as absent_count,
    ROUND(
        (COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT ar.id), 0)) * 100, 2
    ) as attendance_rate
FROM courses c
JOIN users u ON c.professor_id = u.id
LEFT JOIN enrollments e ON c.id = e.course_id
LEFT JOIN attendance_sessions s ON c.id = s.course_id
LEFT JOIN attendance_records ar ON s.id = ar.session_id
GROUP BY c.id, c.name, c.professor_id, u.name;

-- 학생별 출석률 뷰
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT 
    e.student_id,
    us.name as student_name,
    us.student_id as student_number,
    c.id as course_id,
    c.name as course_name,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT ar.id) as attended_sessions,
    COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) as present_count,
    COUNT(DISTINCT CASE WHEN ar.status = 'late' THEN ar.id END) as late_count,
    COUNT(DISTINCT CASE WHEN ar.status = 'absent' THEN ar.id END) as absent_count,
    ROUND(
        (COUNT(DISTINCT CASE WHEN ar.status IN ('present', 'late') THEN ar.id END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT s.id), 0)) * 100, 2
    ) as attendance_rate
FROM enrollments e
JOIN users us ON e.student_id = us.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN attendance_sessions s ON c.id = s.course_id
LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = e.student_id
GROUP BY e.student_id, us.name, us.student_id, c.id, c.name;