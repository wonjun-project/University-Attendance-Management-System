-- 삭제 전 전체 데이터 백업 스크립트
-- 이 스크립트를 먼저 실행하여 결과를 저장해두세요

-- 백업할 강의 목록
CREATE TEMP TABLE backup_courses AS
SELECT c.*
FROM courses c
WHERE c.professor_id = (
  SELECT professor_id FROM professors
  WHERE name = '김교수'
  LIMIT 1
)
AND c.id NOT IN (
  SELECT id FROM courses
  WHERE professor_id = (
    SELECT professor_id FROM professors
    WHERE name = '김교수'
    LIMIT 1
  )
  ORDER BY created_at DESC
  LIMIT 5
);

-- 백업할 수업 세션
CREATE TEMP TABLE backup_class_sessions AS
SELECT cs.*
FROM class_sessions cs
WHERE cs.course_id IN (SELECT id FROM backup_courses);

-- 백업할 출석 기록
CREATE TEMP TABLE backup_attendances AS
SELECT a.*
FROM attendances a
WHERE a.session_id IN (SELECT id FROM backup_class_sessions);

-- 백업할 위치 로그
CREATE TEMP TABLE backup_location_logs AS
SELECT ll.*
FROM location_logs ll
WHERE ll.attendance_id IN (SELECT id FROM backup_attendances);

-- 백업할 수강 등록
CREATE TEMP TABLE backup_course_enrollments AS
SELECT ce.*
FROM course_enrollments ce
WHERE ce.course_id IN (SELECT id FROM backup_courses);

-- 백업 데이터 조회
SELECT 'COURSES' as table_name, COUNT(*) as record_count FROM backup_courses
UNION ALL
SELECT 'CLASS_SESSIONS', COUNT(*) FROM backup_class_sessions
UNION ALL
SELECT 'ATTENDANCES', COUNT(*) FROM backup_attendances
UNION ALL
SELECT 'LOCATION_LOGS', COUNT(*) FROM backup_location_logs
UNION ALL
SELECT 'COURSE_ENROLLMENTS', COUNT(*) FROM backup_course_enrollments;

-- 실제 백업 데이터 출력
SELECT '=== COURSES ===' as section;
SELECT * FROM backup_courses;

SELECT '=== CLASS SESSIONS ===' as section;
SELECT * FROM backup_class_sessions;

SELECT '=== ATTENDANCES ===' as section;
SELECT * FROM backup_attendances;

SELECT '=== LOCATION LOGS ===' as section;
SELECT * FROM backup_location_logs;

SELECT '=== COURSE ENROLLMENTS ===' as section;
SELECT * FROM backup_course_enrollments;
