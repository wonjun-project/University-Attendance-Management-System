-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  student_id TEXT UNIQUE, -- Only for students
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'professor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  professor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  classroom_location JSONB NOT NULL, -- {latitude, longitude, radius}
  schedule JSONB NOT NULL, -- [{day_of_week, start_time, end_time}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Class sessions table
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  qr_code_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendances table
CREATE TABLE IF NOT EXISTS attendances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'left_early')),
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  location_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Location logs table for tracking student positions
CREATE TABLE IF NOT EXISTS location_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_valid BOOLEAN DEFAULT TRUE
);

-- Course enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_student_id ON user_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_course_id ON class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_qr_code ON class_sessions(qr_code);
CREATE INDEX IF NOT EXISTS idx_attendances_session_id ON attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student_id ON attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_attendance_id ON location_logs(attendance_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_timestamp ON location_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments(student_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
DROP TRIGGER IF EXISTS update_class_sessions_updated_at ON class_sessions;
DROP TRIGGER IF EXISTS update_attendances_updated_at ON attendances;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_class_sessions_updated_at BEFORE UPDATE ON class_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON attendances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Professors can manage their courses
DROP POLICY IF EXISTS "Professors can manage own courses" ON courses;
CREATE POLICY "Professors can manage own courses" ON courses 
  FOR ALL USING (
    auth.uid() = professor_id OR 
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'professor')
  );

-- Students can view courses they're enrolled in
DROP POLICY IF EXISTS "Students can view enrolled courses" ON courses;
CREATE POLICY "Students can view enrolled courses" ON courses 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM course_enrollments WHERE course_id = id AND student_id = auth.uid())
  );

-- Class sessions policies
DROP POLICY IF EXISTS "Professors can manage class sessions" ON class_sessions;
DROP POLICY IF EXISTS "Students can view active sessions" ON class_sessions;

CREATE POLICY "Professors can manage class sessions" ON class_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND professor_id = auth.uid())
  );

CREATE POLICY "Students can view active sessions" ON class_sessions
  FOR SELECT USING (
    status = 'active' AND 
    EXISTS (SELECT 1 FROM course_enrollments ce JOIN courses c ON ce.course_id = c.id 
            WHERE c.id = course_id AND ce.student_id = auth.uid())
  );

-- Attendance policies
DROP POLICY IF EXISTS "Students can manage own attendance" ON attendances;
DROP POLICY IF EXISTS "Professors can view course attendance" ON attendances;

CREATE POLICY "Students can manage own attendance" ON attendances
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Professors can view course attendance" ON attendances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM class_sessions cs JOIN courses c ON cs.course_id = c.id 
            WHERE cs.id = session_id AND c.professor_id = auth.uid())
  );

-- Location logs policies
DROP POLICY IF EXISTS "Students can manage own location logs" ON location_logs;
CREATE POLICY "Students can manage own location logs" ON location_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM attendances WHERE id = attendance_id AND student_id = auth.uid())
  );

-- Course enrollments policies
DROP POLICY IF EXISTS "Students can view own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Professors can manage course enrollments" ON course_enrollments;

CREATE POLICY "Students can view own enrollments" ON course_enrollments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Professors can manage course enrollments" ON course_enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND professor_id = auth.uid())
  );

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', new.email), 'student');
  RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();