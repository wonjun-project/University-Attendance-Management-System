-- 수정된 마이그레이션 파일 (SQL 문법 오류 수정)
-- 날짜: 2025-09-24

-- 1. courses 테이블에 누락된 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses'
    AND column_name = 'classroom_location'
  ) THEN
    ALTER TABLE courses
    ADD COLUMN classroom_location JSONB DEFAULT '{"latitude": 37.5665, "longitude": 126.9780, "radius": 50}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses'
    AND column_name = 'schedule'
  ) THEN
    ALTER TABLE courses
    ADD COLUMN schedule JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. predefined_locations 테이블 생성
CREATE TABLE IF NOT EXISTS predefined_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_name TEXT NOT NULL,
  room_number TEXT,
  display_name TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_predefined_locations_building ON predefined_locations(building_name);
CREATE INDEX IF NOT EXISTS idx_predefined_locations_active ON predefined_locations(is_active);

-- 3. RPC 함수 생성
-- get_buildings 함수
CREATE OR REPLACE FUNCTION get_buildings()
RETURNS TABLE(building_name TEXT, room_count BIGINT)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.building_name,
    COUNT(*) as room_count
  FROM predefined_locations pl
  WHERE pl.is_active = true
  GROUP BY pl.building_name
  ORDER BY pl.building_name;
END;
$$ LANGUAGE plpgsql;

-- get_rooms_by_building 함수
CREATE OR REPLACE FUNCTION get_rooms_by_building(p_building_name TEXT)
RETURNS TABLE(
  id UUID,
  room_number TEXT,
  display_name TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  radius INTEGER
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.room_number,
    pl.display_name,
    pl.latitude,
    pl.longitude,
    pl.radius
  FROM predefined_locations pl
  WHERE pl.building_name = p_building_name
    AND pl.is_active = true
  ORDER BY pl.room_number;
END;
$$ LANGUAGE plpgsql;

-- 4. 샘플 데이터 삽입
-- 기존 데이터 삭제 (중복 방지)
DELETE FROM predefined_locations WHERE building_name IN ('제1자연관', '제2자연관', '공학관');

-- 새 데이터 삽입
INSERT INTO predefined_locations (building_name, room_number, display_name, latitude, longitude, radius) VALUES
('제1자연관', '501호', '제1자연관 501호', 36.6291, 127.4565, 50),
('제1자연관', '502호', '제1자연관 502호', 36.6292, 127.4566, 50),
('제1자연관', '503호', '제1자연관 503호', 36.6293, 127.4567, 50),
('제2자연관', '301호', '제2자연관 301호', 36.6294, 127.4568, 50),
('제2자연관', '302호', '제2자연관 302호', 36.6295, 127.4569, 50),
('공학관', '201호', '공학관 201호', 36.6296, 127.4570, 50),
('공학관', '202호', '공학관 202호', 36.6297, 127.4571, 50);

-- 5. RLS 정책 추가
ALTER TABLE predefined_locations ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (존재하는 경우)
DROP POLICY IF EXISTS "Allow authenticated users to read predefined locations" ON predefined_locations;
DROP POLICY IF EXISTS "Allow service role to manage predefined locations" ON predefined_locations;

-- 새 정책 생성
CREATE POLICY "Allow authenticated users to read predefined locations"
ON predefined_locations FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Allow service role to manage predefined locations"
ON predefined_locations FOR ALL
TO service_role
USING (true);

-- 6. 테스트 쿼리 (실행 후 확인용)
-- SELECT * FROM get_buildings();
-- SELECT * FROM get_rooms_by_building('제1자연관');