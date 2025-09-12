-- Add start_time and end_time columns to class_sessions table
-- This migration is needed for the advanced management features

ALTER TABLE class_sessions 
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME,
ADD COLUMN is_active BOOLEAN DEFAULT FALSE;

-- Update the existing schema to be compatible with the new features
-- Add course description and location fields if they don't exist
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS schedule TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 50;

-- Drop the old JSONB location column if it exists and add new structured location fields
-- First, let's safely handle this transition
DO $$ 
BEGIN
    -- Check if classroom_location column exists and is JSONB
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' 
        AND column_name = 'classroom_location' 
        AND data_type = 'jsonb'
    ) THEN
        -- Migrate data from JSONB to separate columns if needed
        UPDATE courses SET 
            location_latitude = (classroom_location->>'latitude')::DECIMAL(10, 8),
            location_longitude = (classroom_location->>'longitude')::DECIMAL(11, 8),
            location_radius = COALESCE((classroom_location->>'radius')::INTEGER, 50)
        WHERE classroom_location IS NOT NULL;
        
        -- Drop the old column
        ALTER TABLE courses DROP COLUMN classroom_location;
    END IF;
    
    -- Do the same for schedule JSONB if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' 
        AND column_name = 'schedule' 
        AND data_type = 'jsonb'
    ) THEN
        -- For now, just drop it since we're using TEXT for schedule
        ALTER TABLE courses DROP COLUMN schedule;
        ALTER TABLE courses ADD COLUMN schedule TEXT;
    END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_class_sessions_start_time ON class_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_class_sessions_end_time ON class_sessions(end_time);
CREATE INDEX IF NOT EXISTS idx_class_sessions_is_active ON class_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_location ON courses(location_latitude, location_longitude);

-- Add some sample data for testing if tables are empty
INSERT INTO courses (id, name, course_code, professor_id, description, schedule, location, location_latitude, location_longitude, location_radius)
SELECT 
    uuid_generate_v4(),
    '컴퓨터과학개론',
    'CS101',
    (SELECT id FROM users WHERE role = 'professor' LIMIT 1),
    '컴퓨터과학의 기초 개념을 학습합니다.',
    '화/목 09:00-10:30',
    '공학관 201호',
    37.5665,
    126.9780,
    50
WHERE NOT EXISTS (SELECT 1 FROM courses LIMIT 1)
AND EXISTS (SELECT 1 FROM users WHERE role = 'professor' LIMIT 1);

COMMENT ON COLUMN class_sessions.start_time IS 'Session start time';
COMMENT ON COLUMN class_sessions.end_time IS 'Session end time';
COMMENT ON COLUMN class_sessions.is_active IS 'Whether the session is currently active';
COMMENT ON COLUMN courses.description IS 'Course description';
COMMENT ON COLUMN courses.location IS 'Human-readable location (e.g., 공학관 201호)';
COMMENT ON COLUMN courses.location_latitude IS 'GPS latitude for location verification';
COMMENT ON COLUMN courses.location_longitude IS 'GPS longitude for location verification';
COMMENT ON COLUMN courses.location_radius IS 'Allowed radius in meters for attendance';