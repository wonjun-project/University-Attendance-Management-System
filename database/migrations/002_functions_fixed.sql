-- Function to calculate distance between two GPS coordinates
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL, 
  lon1 DECIMAL, 
  lat2 DECIMAL, 
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  earth_radius DECIMAL := 6371000; -- Earth radius in meters
  delta_lat DECIMAL;
  delta_lon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  delta_lat := RADIANS(lat2 - lat1);
  delta_lon := RADIANS(lon2 - lon1);
  
  a := SIN(delta_lat/2) * SIN(delta_lat/2) + 
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
       SIN(delta_lon/2) * SIN(delta_lon/2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate student location
CREATE OR REPLACE FUNCTION validate_student_location(
  p_student_lat DECIMAL,
  p_student_lon DECIMAL,
  p_classroom_location JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  classroom_lat DECIMAL;
  classroom_lon DECIMAL;
  allowed_radius DECIMAL;
  distance DECIMAL;
BEGIN
  classroom_lat := (p_classroom_location->>'latitude')::DECIMAL;
  classroom_lon := (p_classroom_location->>'longitude')::DECIMAL;
  allowed_radius := (p_classroom_location->>'radius')::DECIMAL;
  
  distance := calculate_distance(
    p_student_lat, 
    p_student_lon, 
    classroom_lat, 
    classroom_lon
  );
  
  RETURN distance <= allowed_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check in student attendance
CREATE OR REPLACE FUNCTION check_in_attendance(
  p_session_id UUID,
  p_student_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_course_id UUID;
  v_classroom_location JSONB;
  v_attendance_id UUID;
  v_is_valid BOOLEAN;
  v_session_status TEXT;
  v_qr_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if session is active and not expired
  SELECT cs.course_id, cs.status, cs.qr_code_expires_at, c.classroom_location
  INTO v_course_id, v_session_status, v_qr_expires_at, v_classroom_location
  FROM class_sessions cs
  JOIN courses c ON cs.course_id = c.id
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
  
  -- Check if student is enrolled in the course
  IF NOT EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = v_course_id AND student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not enrolled in this course');
  END IF;
  
  -- Validate location
  v_is_valid := validate_student_location(p_latitude, p_longitude, v_classroom_location);
  
  IF NOT v_is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Location not valid for this classroom');
  END IF;
  
  -- Create or update attendance record
  INSERT INTO attendances (session_id, student_id, status, check_in_time, location_verified)
  VALUES (p_session_id, p_student_id, 'present', NOW(), true)
  ON CONFLICT (session_id, student_id) 
  DO UPDATE SET 
    status = 'present',
    check_in_time = NOW(),
    location_verified = true,
    updated_at = NOW()
  RETURNING id INTO v_attendance_id;
  
  -- Log the location
  INSERT INTO location_logs (attendance_id, latitude, longitude, accuracy, is_valid)
  VALUES (v_attendance_id, p_latitude, p_longitude, p_accuracy, v_is_valid);
  
  RETURN jsonb_build_object('success', true, 'attendance_id', v_attendance_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to continuously track student location
CREATE OR REPLACE FUNCTION track_student_location(
  p_attendance_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_accuracy DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_session_id UUID;
  v_course_id UUID;
  v_classroom_location JSONB;
  v_is_valid BOOLEAN;
  v_student_id UUID;
BEGIN
  -- Get attendance and course info
  SELECT a.session_id, a.student_id, cs.course_id, c.classroom_location
  INTO v_session_id, v_student_id, v_course_id, v_classroom_location
  FROM attendances a
  JOIN class_sessions cs ON a.session_id = cs.id
  JOIN courses c ON cs.course_id = c.id
  WHERE a.id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attendance record not found');
  END IF;
  
  -- Validate location
  v_is_valid := validate_student_location(p_latitude, p_longitude, v_classroom_location);
  
  -- Log the location
  INSERT INTO location_logs (attendance_id, latitude, longitude, accuracy, is_valid)
  VALUES (p_attendance_id, p_latitude, p_longitude, p_accuracy, v_is_valid);
  
  -- If location is invalid, mark as left early
  IF NOT v_is_valid THEN
    UPDATE attendances 
    SET status = 'left_early', updated_at = NOW()
    WHERE id = p_attendance_id AND status = 'present';
  END IF;
  
  RETURN jsonb_build_object('success', true, 'location_valid', v_is_valid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique QR code
CREATE OR REPLACE FUNCTION generate_qr_code(
  p_course_id UUID,
  p_date DATE,
  p_expires_in_minutes INTEGER DEFAULT 30
) RETURNS TEXT AS $$
DECLARE
  v_qr_code TEXT;
  v_session_id UUID;
BEGIN
  -- Generate unique QR code
  v_qr_code := encode(gen_random_bytes(16), 'hex');
  
  -- Create or update class session
  INSERT INTO class_sessions (course_id, date, qr_code, qr_code_expires_at, status)
  VALUES (
    p_course_id, 
    p_date, 
    v_qr_code, 
    NOW() + (p_expires_in_minutes || ' minutes')::INTERVAL,
    'active'
  )
  ON CONFLICT (course_id, date) 
  DO UPDATE SET 
    qr_code = v_qr_code,
    qr_code_expires_at = NOW() + (p_expires_in_minutes || ' minutes')::INTERVAL,
    status = 'active',
    updated_at = NOW()
  RETURNING qr_code;
  
  RETURN v_qr_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;