-- Migrate functions to use split location columns on courses (location_latitude, location_longitude, location_radius)

-- Ensure required columns exist on courses (idempotent)
ALTER TABLE courses 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS schedule TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_radius INTEGER DEFAULT 50;

-- Recreate calculate_distance (idempotent)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  earth_radius DECIMAL := 6371000;
  delta_lat DECIMAL;
  delta_lon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  delta_lat := RADIANS(lat2 - lat1);
  delta_lon := RADIANS(lon2 - lon1);
  a := SIN(delta_lat/2) * SIN(delta_lat/2)
     + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(delta_lon/2) * SIN(delta_lon/2);
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate location against courses.* split columns
CREATE OR REPLACE FUNCTION validate_student_location(
  p_student_lat DECIMAL,
  p_student_lon DECIMAL,
  p_course_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  classroom_lat DECIMAL;
  classroom_lon DECIMAL;
  allowed_radius DECIMAL;
  distance DECIMAL;
BEGIN
  SELECT location_latitude, location_longitude, COALESCE(location_radius, 50)
  INTO classroom_lat, classroom_lon, allowed_radius
  FROM courses
  WHERE id = p_course_id;

  IF classroom_lat IS NULL OR classroom_lon IS NULL THEN
    -- If course has no location, treat as invalid
    RETURN FALSE;
  END IF;

  distance := calculate_distance(p_student_lat, p_student_lon, classroom_lat, classroom_lon);
  RETURN distance <= allowed_radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check-in attendance using split columns
CREATE OR REPLACE FUNCTION check_in_attendance(
  p_session_id UUID,
  p_student_id TEXT,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_course_id UUID;
  v_attendance_id UUID;
  v_is_valid BOOLEAN;
  v_session_status TEXT;
  v_qr_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT cs.course_id, cs.status, cs.qr_code_expires_at
  INTO v_course_id, v_session_status, v_qr_expires_at
  FROM class_sessions cs
  WHERE cs.id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_session_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is not active');
  END IF;

  IF v_qr_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'QR code has expired');
  END IF;

  -- Student must be enrolled
  IF NOT EXISTS (
    SELECT 1 FROM course_enrollments WHERE course_id = v_course_id AND student_id = p_student_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not enrolled in this course');
  END IF;

  -- Validate location
  v_is_valid := validate_student_location(p_latitude, p_longitude, v_course_id);
  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Location not valid for this classroom');
  END IF;

  -- Upsert attendance
  INSERT INTO attendances (session_id, student_id, status, check_in_time, location_verified)
  VALUES (p_session_id, p_student_id, 'present', NOW(), true)
  ON CONFLICT (session_id, student_id)
  DO UPDATE SET status = 'present', check_in_time = NOW(), location_verified = true, updated_at = NOW()
  RETURNING id INTO v_attendance_id;

  -- Log location
  INSERT INTO location_logs (attendance_id, latitude, longitude, accuracy, is_valid)
  VALUES (v_attendance_id, p_latitude, p_longitude, p_accuracy, v_is_valid);

  RETURN jsonb_build_object('success', true, 'attendance_id', v_attendance_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track student location using split columns
CREATE OR REPLACE FUNCTION track_student_location(
  p_attendance_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_session_id UUID;
  v_course_id UUID;
  v_is_valid BOOLEAN;
  v_student_id TEXT;
BEGIN
  SELECT a.session_id, a.student_id, cs.course_id
  INTO v_session_id, v_student_id, v_course_id
  FROM attendances a
  JOIN class_sessions cs ON a.session_id = cs.id
  WHERE a.id = p_attendance_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance record not found');
  END IF;

  v_is_valid := validate_student_location(p_latitude, p_longitude, v_course_id);

  INSERT INTO location_logs (attendance_id, latitude, longitude, accuracy, is_valid)
  VALUES (p_attendance_id, p_latitude, p_longitude, p_accuracy, v_is_valid);

  IF NOT v_is_valid THEN
    UPDATE attendances SET status = 'left_early', updated_at = NOW()
    WHERE id = p_attendance_id AND status = 'present';
  END IF;

  RETURN jsonb_build_object('success', true, 'location_valid', v_is_valid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent: ensure a demo course exists in split columns shape for testing
DO $$
DECLARE
  v_exists UUID;
BEGIN
  SELECT id INTO v_exists FROM courses WHERE id = 'course-demo-001';
  IF v_exists IS NULL THEN
    INSERT INTO courses (
      id, name, course_code, professor_id, description, schedule, location,
      location_latitude, location_longitude, location_radius
    ) VALUES (
      'course-demo-001', '컴퓨터과학개론', 'CS101', 'prof001',
      '컴퓨터과학의 기초 개념을 학습합니다.', '화/목 09:00-10:30', '공학관 201호',
      37.5665, 126.9780, 10000
    );
  END IF;
END $$;
