-- QR 스캔을 위한 세션 접근 정책 수정
-- 활성 세션은 모든 사용자가 조회할 수 있도록 허용

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Students can view active sessions" ON class_sessions;

-- 새로운 정책 추가
-- 1. 교수는 자신의 모든 세션을 관리할 수 있음
DROP POLICY IF EXISTS "Professors can manage class sessions" ON class_sessions;
CREATE POLICY "Professors can manage class sessions" ON class_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE id = course_id
      AND professor_id = auth.uid()
    )
  );

-- 2. 활성 세션은 모든 인증된 사용자가 조회할 수 있음 (QR 스캔용)
CREATE POLICY "Anyone can view active sessions for QR scanning" ON class_sessions
  FOR SELECT USING (
    status = 'active'
    AND qr_code_expires_at > NOW()
  );

-- 3. 학생은 자신이 등록된 과목의 모든 세션을 볼 수 있음
CREATE POLICY "Students can view enrolled course sessions" ON class_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.course_id = class_sessions.course_id
      AND ce.student_id = auth.uid()
    )
  );

-- 4. Service role은 모든 것을 할 수 있음 (이미 RLS 우회)
-- Service role key를 사용하면 자동으로 RLS가 우회됨

COMMENT ON POLICY "Anyone can view active sessions for QR scanning" ON class_sessions
IS 'QR 코드 스캔을 위해 활성 세션은 모든 인증된 사용자가 조회할 수 있도록 허용';