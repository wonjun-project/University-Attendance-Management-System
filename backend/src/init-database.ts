import { supabase } from './config/supabase';
import bcrypt from 'bcryptjs';

const DATABASE_SCHEMA = `
-- 사용자 테이블 (학생, 교수)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20) UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'professor')),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 강의 테이블
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester VARCHAR(20) NOT NULL,
    room VARCHAR(100),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    gps_radius INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 수강신청 테이블
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- 출석 세션 테이블
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    qr_code VARCHAR(500),
    auth_code VARCHAR(10),
    is_active BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 출석 기록 테이블
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    qr_scanned_at TIMESTAMP WITH TIME ZONE,
    gps_verified_at TIMESTAMP WITH TIME ZONE,
    auth_verified_at TIMESTAMP WITH TIME ZONE,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    manual_override BOOLEAN DEFAULT FALSE,
    manual_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- 시스템 로그 테이블
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function checkTablesExist(): Promise<boolean> {
  try {
    // 필수 테이블들 확인
    const requiredTables = ['users', 'courses', 'enrollments', 'attendance_sessions', 'attendance_records'];
    
    for (const tableName of requiredTables) {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      if (error) {
        console.log(`❌ 테이블 '${tableName}' 없음:`, error.message);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ 테이블 확인 중 오류:', error);
    return false;
  }
}

export async function initializeDatabase() {
  try {
    console.log('🔄 데이터베이스 스키마 초기화 중...');
    
    // 테이블 존재 여부 확인
    const { data: courses, error } = await supabase.from('courses').select('id').limit(1);
    
    if (error) {
      console.log('⚠️  필수 테이블이 존재하지 않습니다.');
      console.log('📋 Supabase 대시보드에서 complete-schema.sql을 실행하세요.');
      console.log('🔗 Supabase URL:', process.env.SUPABASE_URL);
      return;
    }

    console.log('✅ 데이터베이스 스키마 초기화 완료');

    // 데모 사용자 생성
    await createDemoUsers();
    
    console.log('🎯 데이터베이스 초기화 성공!');
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
  }
}

async function createDemoUsers() {
  console.log('👥 데모 사용자 생성 중...');
  
  const passwordHash = await bcrypt.hash('password123', 12);
  
  // 교수 계정 생성
  const { error: profError } = await supabase
    .from('users')
    .upsert({
      email: 'professor1@university.ac.kr',
      password_hash: passwordHash,
      name: '김교수',
      role: 'professor',
      phone: '010-1234-5678'
    }, {
      onConflict: 'email'
    });

  if (profError) {
    console.error('교수 계정 생성 오류:', profError);
  } else {
    console.log('✅ 교수 계정 생성 완료');
  }

  // 학생 계정 생성
  const { error: studentError } = await supabase
    .from('users')
    .upsert({
      email: 'student1@university.ac.kr',
      password_hash: passwordHash,
      name: '홍학생',
      student_id: '2024001234',
      role: 'student',
      phone: '010-9876-5432'
    }, {
      onConflict: 'email'
    });

  if (studentError) {
    console.error('학생 계정 생성 오류:', studentError);
  } else {
    console.log('✅ 학생 계정 생성 완료');
  }

  // 사용자 수 확인
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact' });
  
  console.log(`📊 총 사용자 수: ${count}명`);
}