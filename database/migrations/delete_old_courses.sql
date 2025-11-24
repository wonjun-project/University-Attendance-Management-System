-- 최근 5개 강의만 남기고 나머지 삭제하기
-- 주의: 이 스크립트는 되돌릴 수 없으므로 실행 전 반드시 백업하세요!

-- 1단계: 삭제할 강의 목록 확인 (실행 전 확인용)
-- 이 쿼리를 먼저 실행하여 삭제될 강의를 확인하세요
SELECT
  c.id,
  c.name,
  c.course_code,
  c.created_at,
  COUNT(DISTINCT cs.id) as session_count,
  COUNT(DISTINCT a.id) as attendance_count
FROM courses c
LEFT JOIN class_sessions cs ON c.id = cs.course_id
LEFT JOIN attendances a ON cs.id = a.session_id
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
)
GROUP BY c.id, c.name, c.course_code, c.created_at
ORDER BY c.created_at DESC;

-- 2단계: 실제 삭제 실행
-- CASCADE로 인해 관련된 class_sessions, attendances, location_logs, course_enrollments도 자동 삭제됩니다
DELETE FROM courses
WHERE id IN (
  SELECT c.id FROM courses c
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
  )
);

-- 3단계: 삭제 후 남은 강의 확인
SELECT
  c.id,
  c.name,
  c.course_code,
  c.created_at,
  COUNT(DISTINCT cs.id) as session_count,
  COUNT(DISTINCT a.id) as attendance_count
FROM courses c
LEFT JOIN class_sessions cs ON c.id = cs.course_id
LEFT JOIN attendances a ON cs.id = a.session_id
WHERE c.professor_id = (
  SELECT professor_id FROM professors
  WHERE name = '김교수'
  LIMIT 1
)
GROUP BY c.id, c.name, c.course_code, c.created_at
ORDER BY c.created_at DESC;
