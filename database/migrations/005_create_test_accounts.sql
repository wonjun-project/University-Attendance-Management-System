-- Create test accounts for development and testing
-- This migration adds sample students and professors for testing

-- Add test professor
INSERT INTO professors (professor_id, name, email, password_hash) 
VALUES (
  'prof001',
  '김교수',
  'prof001@university.edu',
  '$2a$12$LQv3c1yqBwEHxeDjsxPLAOh/2PKMzxs7.3/3oGT4.3rEbVq7z/wUe'  -- password123
) ON CONFLICT (professor_id) DO NOTHING;

-- Add test students
INSERT INTO students (student_id, name, password_hash) VALUES 
('stu001', '김학생', '$2a$12$LQv3c1yqBwEHxeDjsxPLAOh/2PKMzxs7.3/3oGT4.3rEbVq7z/wUe'), -- password123
('stu002', '이학생', '$2a$12$LQv3c1yqBwEHxeDjsxPLAOh/2PKMzxs7.3/3oGT4.3rEbVq7z/wUe'), -- password123
('stu003', '박학생', '$2a$12$LQv3c1yqBwEHxeDjsxPLAOh/2PKMzxs7.3/3oGT4.3rEbVq7z/wUe'), -- password123
('202012345', '홍학생', '$2a$12$LQv3c1yqBwEHxeDjsxPLAOh/2PKMzxs7.3/3oGT4.3rEbVq7z/wUe') -- password123
ON CONFLICT (student_id) DO NOTHING;

-- Create a test course
INSERT INTO courses (id, name, course_code, professor_id, classroom_location, schedule)
VALUES (
  'course-demo-001',
  '컴퓨터과학개론',
  'CS101',
  'prof001',
  '{"latitude": 37.5665, "longitude": 126.9780, "radius": 50}',
  '[{"day_of_week": 2, "start_time": "09:00", "end_time": "10:30"}, {"day_of_week": 4, "start_time": "09:00", "end_time": "10:30"}]'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  course_code = EXCLUDED.course_code,
  classroom_location = EXCLUDED.classroom_location,
  schedule = EXCLUDED.schedule;

-- Enroll test students in the course  
INSERT INTO course_enrollments (course_id, student_id) VALUES
('course-demo-001', 'stu001'),
('course-demo-001', 'stu002'),
('course-demo-001', 'stu003'),
('course-demo-001', '202012345')
ON CONFLICT (course_id, student_id) DO NOTHING;

COMMENT ON TABLE professors IS 'Test professor accounts: prof001/password123';
COMMENT ON TABLE students IS 'Test student accounts: stu001, stu002, stu003, 202012345 - all with password123';