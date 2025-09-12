-- Create predefined_locations table for common campus locations

CREATE TABLE IF NOT EXISTS predefined_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_name TEXT NOT NULL,
  room_number TEXT,
  display_name TEXT NOT NULL, -- "공학관 201호"
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_predefined_locations_building ON predefined_locations(building_name);
CREATE INDEX IF NOT EXISTS idx_predefined_locations_active ON predefined_locations(is_active);

-- Enable RLS
ALTER TABLE predefined_locations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read predefined locations
CREATE POLICY "Allow authenticated users to read predefined locations"
ON predefined_locations FOR SELECT 
TO authenticated 
USING (is_active = true);

-- Allow service role to manage predefined locations (for admin operations)
CREATE POLICY "Allow service role to manage predefined locations"
ON predefined_locations FOR ALL 
TO service_role 
USING (true);

-- Insert sample campus locations
INSERT INTO predefined_locations (building_name, room_number, display_name, latitude, longitude, radius) VALUES
('공학관', '201호', '공학관 201호', 37.5665, 126.9780, 50),
('공학관', '202호', '공학관 202호', 37.5666, 126.9781, 50),
('공학관', '301호', '공학관 301호', 37.5667, 126.9782, 50),
('공학관', '302호', '공학관 302호', 37.5668, 126.9783, 50),
('과학관', '101호', '과학관 101호', 37.5660, 126.9770, 50),
('과학관', '102호', '과학관 102호', 37.5661, 126.9771, 50),
('과학관', '201호', '과학관 201호', 37.5662, 126.9772, 50),
('인문관', '101호', '인문관 101호', 37.5670, 126.9790, 50),
('인문관', '201호', '인문관 201호', 37.5671, 126.9791, 50),
('인문관', '301호', '인문관 301호', 37.5672, 126.9792, 50),
('도서관', '열람실1', '도서관 열람실1', 37.5675, 126.9795, 60),
('도서관', '열람실2', '도서관 열람실2', 37.5676, 126.9796, 60),
('학생회관', '대강당', '학생회관 대강당', 37.5680, 126.9800, 80),
('체육관', '실내체육관', '체육관 실내체육관', 37.5655, 126.9760, 100);

-- Create function to get buildings list
CREATE OR REPLACE FUNCTION get_buildings()
RETURNS TABLE(building_name TEXT, room_count BIGINT) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get rooms by building
CREATE OR REPLACE FUNCTION get_rooms_by_building(p_building_name TEXT)
RETURNS TABLE(
  id UUID,
  room_number TEXT,
  display_name TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  radius INTEGER
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;