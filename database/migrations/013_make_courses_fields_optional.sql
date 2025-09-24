-- courses 테이블의 필수 필드를 옵셔널로 변경
-- 기존 NOT NULL 제약을 제거하고 기본값 설정

-- classroom_location을 NULL 허용으로 변경하고 기본값 설정
ALTER TABLE courses
ALTER COLUMN classroom_location DROP NOT NULL,
ALTER COLUMN classroom_location SET DEFAULT '{"latitude": 37.5665, "longitude": 126.9780, "radius": 50}'::jsonb;

-- schedule을 NULL 허용으로 변경하고 기본값 설정
ALTER TABLE courses
ALTER COLUMN schedule DROP NOT NULL,
ALTER COLUMN schedule SET DEFAULT '[]'::jsonb;

-- 기존 NULL 값들에 기본값 설정 (혹시 있다면)
UPDATE courses
SET classroom_location = '{"latitude": 37.5665, "longitude": 126.9780, "radius": 50}'::jsonb
WHERE classroom_location IS NULL;

UPDATE courses
SET schedule = '[]'::jsonb
WHERE schedule IS NULL;

-- 추가 location 관련 컬럼들이 없는 경우 추가 (이미 추가된 경우 무시됨)
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 50;