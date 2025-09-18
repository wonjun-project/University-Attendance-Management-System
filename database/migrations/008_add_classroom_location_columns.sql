-- class_sessions 테이블에 교실 위치 정보 컬럼 추가
ALTER TABLE class_sessions
ADD COLUMN IF NOT EXISTS classroom_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS classroom_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS classroom_radius INTEGER DEFAULT 100;

-- 기본값 설정 (기존 데이터를 위해)
UPDATE class_sessions
SET
  classroom_latitude = 37.5665,
  classroom_longitude = 126.9780,
  classroom_radius = 100
WHERE classroom_latitude IS NULL;

-- 인덱스 추가 (위치 기반 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_class_sessions_location
ON class_sessions(classroom_latitude, classroom_longitude)
WHERE classroom_latitude IS NOT NULL AND classroom_longitude IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN class_sessions.classroom_latitude IS '교실 위도';
COMMENT ON COLUMN class_sessions.classroom_longitude IS '교실 경도';
COMMENT ON COLUMN class_sessions.classroom_radius IS '허용 반경 (미터)';