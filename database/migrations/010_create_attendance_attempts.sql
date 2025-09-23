-- Migration 010: attendance_attempts 테이블 및 관련 정책 추가

-- attendance_attempts 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  client_timestamp TIMESTAMP WITH TIME ZONE,
  server_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  clock_skew_seconds INTEGER,
  result TEXT NOT NULL CHECK (result IN ('success', 'retry', 'duplicate', 'expired', 'clock_skew', 'error')),
  failure_reason TEXT,
  device_lat NUMERIC(10, 7),
  device_lng NUMERIC(10, 7),
  device_accuracy NUMERIC,
  device_type TEXT,
  network_type TEXT,
  correlation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 조회 및 정렬 성능 개선 인덱스
CREATE INDEX IF NOT EXISTS idx_attendance_attempts_session_time
  ON attendance_attempts (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_attempts_student_time
  ON attendance_attempts (student_id, created_at DESC);

-- Row Level Security 적용
ALTER TABLE attendance_attempts ENABLE ROW LEVEL SECURITY;

-- 학생은 자신의 시도만 조회 가능
DROP POLICY IF EXISTS "Students can view own attendance attempts" ON attendance_attempts;
CREATE POLICY "Students can view own attendance attempts"
  ON attendance_attempts
  FOR SELECT
  USING (student_id = auth.uid());

-- 교수는 담당 강의 학생들의 시도를 조회 가능
DROP POLICY IF EXISTS "Professors can view course attendance attempts" ON attendance_attempts;
CREATE POLICY "Professors can view course attendance attempts"
  ON attendance_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM class_sessions cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.id = attendance_attempts.session_id
        AND c.professor_id = auth.uid()
    )
  );

-- service role 또는 trusted 백엔드만 INSERT/DELETE 가능 (Supabase RLS를 우회하는 키 사용)
DROP POLICY IF EXISTS "Service role manages attendance attempts" ON attendance_attempts;
CREATE POLICY "Service role manages attendance attempts"
  ON attendance_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 24시간 이전 데이터 정리를 위한 헬퍼 함수
CREATE OR REPLACE FUNCTION purge_old_attendance_attempts(max_age interval)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM attendance_attempts
  WHERE created_at < NOW() - max_age;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION purge_old_attendance_attempts IS
  'attendance_attempts 테이블에서 오래된 시도 기록을 삭제합니다. 기본 보존 기간은 24시간입니다.';
