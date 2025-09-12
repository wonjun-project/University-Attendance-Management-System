-- JWT 기반 인증 시스템용 테스트 데이터
-- 비밀번호는 모두 'password123'
-- bcrypt 해시: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW

-- 테스트 학생 계정
INSERT INTO students (student_id, name, password_hash) VALUES
('2024001', '홍길동', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('2024002', '김영희', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('2024003', '박철수', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('student001', '이민수', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('test123', '최지민', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW')
ON CONFLICT (student_id) DO NOTHING;

-- 테스트 교수 계정
INSERT INTO professors (professor_id, name, email, password_hash) VALUES
('prof001', '김교수', 'kim.prof@university.ac.kr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('prof002', '이교수', 'lee.prof@university.ac.kr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW'),
('teacher123', '박교수', 'park.prof@university.ac.kr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewNCopxXzQtzU2nW')
ON CONFLICT (professor_id) DO NOTHING;

-- 테스트 강의 생성
INSERT INTO courses (name, course_code, professor_id, classroom_location, schedule) VALUES
(
  '컴퓨터과학개론', 
  'CS101', 
  'prof001', 
  '{"latitude": 37.2796, "longitude": 127.0447, "radius": 50}',
  '[{"day_of_week": 1, "start_time": "09:00", "end_time": "10:30"}]'
),
(
  '자료구조론', 
  'CS201', 
  'prof001', 
  '{"latitude": 37.2797, "longitude": 127.0448, "radius": 50}',
  '[{"day_of_week": 3, "start_time": "10:45", "end_time": "12:15"}]'
),
(
  '데이터베이스시스템', 
  'CS301', 
  'prof002', 
  '{"latitude": 37.2798, "longitude": 127.0449, "radius": 50}',
  '[{"day_of_week": 5, "start_time": "13:30", "end_time": "15:00"}]'
)
ON CONFLICT DO NOTHING;