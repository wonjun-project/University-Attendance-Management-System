/**
 * 통합 테스트 스크립트
 * 주요 API 엔드포인트들이 정상 작동하는지 확인
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
let authToken = '';
let userId = '';
let courseId = '';
let sessionId = '';

// 테스트 데이터
const testProfessor = {
  email: 'test-professor@example.com',
  password: 'password123',
  name: '테스트교수',
  role: 'professor'
};

const testStudent = {
  email: 'test-student@example.com',
  password: 'password123',
  name: '테스트학생',
  role: 'student',
  student_id: 'TEST001'
};

const testCourse = {
  course_code: 'TEST101',
  name: '통합테스트강의',
  semester: '2024-2',
  room: '테스트강의실',
  schedule: '월수금 09:00-10:30',
  description: '통합 테스트용 강의입니다.',
  gps_latitude: 37.5665,
  gps_longitude: 126.9780,
  gps_radius: 50
};

// API 클라이언트 설정
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 토큰 설정
const setAuthToken = (token) => {
  authToken = token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

// 테스트 함수들
const runTests = async () => {
  console.log('🧪 통합 테스트 시작\n');
  
  try {
    // 1. Health Check
    console.log('1️⃣ Health Check 테스트');
    const health = await api.get('/health');
    console.log(`✅ Health Check: ${health.data.status}`);
    
    // 2. 교수 회원가입
    console.log('\n2️⃣ 교수 회원가입 테스트');
    try {
      const professorRegister = await api.post('/api/auth/register', testProfessor);
      console.log('✅ 교수 회원가입 성공');
      setAuthToken(professorRegister.data.data.tokens.accessToken);
      userId = professorRegister.data.data.user.id;
    } catch (error) {
      if (error.response?.data?.error?.message?.includes('이미 존재')) {
        console.log('⚠️ 이미 존재하는 교수 계정 - 로그인 시도');
        const login = await api.post('/api/auth/login', {
          email: testProfessor.email,
          password: testProfessor.password
        });
        setAuthToken(login.data.data.tokens.accessToken);
        userId = login.data.data.user.id;
        console.log('✅ 교수 로그인 성공');
      } else {
        throw error;
      }
    }
    
    // 3. 강의 생성
    console.log('\n3️⃣ 강의 생성 테스트');
    try {
      const courseCreate = await api.post('/api/courses', testCourse);
      courseId = courseCreate.data.data.course.id;
      console.log('✅ 강의 생성 성공');
    } catch (error) {
      console.log('⚠️ 강의 생성 실패 (이미 존재할 수 있음)');
      // 기존 강의 조회
      const courses = await api.get('/api/courses');
      if (courses.data.data.courses.length > 0) {
        courseId = courses.data.data.courses[0].id;
        console.log('✅ 기존 강의 사용');
      } else {
        throw error;
      }
    }
    
    // 4. 출석 세션 생성
    console.log('\n4️⃣ 출석 세션 생성 테스트');
    const sessionData = {
      courseId: courseId,
      sessionDate: new Date().toISOString().split('T')[0],
      authCode: '1234'
    };
    const sessionCreate = await api.post('/api/attendance/sessions', sessionData);
    sessionId = sessionCreate.data.data.session.id;
    console.log('✅ 출석 세션 생성 성공');
    
    // 5. QR 코드 생성
    console.log('\n5️⃣ QR 코드 생성 테스트');
    const qrGenerate = await api.post(`/api/attendance/sessions/${sessionId}/generate-qr`, {
      width: 300,
      height: 300
    });
    console.log('✅ QR 코드 생성 성공');
    
    // 6. 세션 활성화
    console.log('\n6️⃣ 세션 활성화 테스트');
    const sessionActivate = await api.put(`/api/attendance/sessions/${sessionId}/activate`, {
      isActive: true
    });
    console.log('✅ 세션 활성화 성공');
    
    // 7. 학생 회원가입
    console.log('\n7️⃣ 학생 회원가입 테스트');
    let studentToken = '';
    let studentId = '';
    try {
      const studentRegister = await api.post('/api/auth/register', testStudent);
      studentToken = studentRegister.data.data.tokens.accessToken;
      studentId = studentRegister.data.data.user.id;
      console.log('✅ 학생 회원가입 성공');
    } catch (error) {
      if (error.response?.data?.error?.message?.includes('이미 존재')) {
        console.log('⚠️ 이미 존재하는 학생 계정 - 로그인 시도');
        const login = await api.post('/api/auth/login', {
          email: testStudent.email,
          password: testStudent.password
        });
        studentToken = login.data.data.tokens.accessToken;
        studentId = login.data.data.user.id;
        console.log('✅ 학생 로그인 성공');
      } else {
        throw error;
      }
    }
    
    // 8. 학생 토큰으로 출석 체크 시도
    console.log('\n8️⃣ 출석 체크 테스트');
    api.defaults.headers.common['Authorization'] = `Bearer ${studentToken}`;
    
    // QR 코드로 출석 체크
    const qrCode = qrGenerate.data.data.sessionInfo.qr_code;
    const attendanceCheck = await api.post('/api/attendance/check', {
      qrCode: qrCode
    });
    const recordId = attendanceCheck.data.data.recordId;
    console.log('✅ QR 스캔 성공');
    
    // GPS 위치 검증 (테스트용 좌표)
    const gpsVerify = await api.post('/api/attendance/verify-location', {
      recordId: recordId,
      latitude: testCourse.gps_latitude,
      longitude: testCourse.gps_longitude,
      accuracy: 10
    });
    console.log('✅ GPS 검증 성공');
    
    // 인증 코드 확인
    const authVerify = await api.post('/api/attendance/verify-auth-code', {
      recordId: recordId,
      authCode: '1234'
    });
    console.log('✅ 인증 코드 확인 성공');
    
    // 9. 교수 토큰으로 통계 조회
    console.log('\n9️⃣ 출석 통계 조회 테스트');
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    const courseStats = await api.get(`/api/attendance/professor/course-stats/${courseId}`);
    console.log('✅ 강의별 통계 조회 성공');
    
    const professorSessions = await api.get('/api/attendance/professor/sessions');
    console.log('✅ 교수 세션 목록 조회 성공');
    
    // 10. 학생 토큰으로 개인 통계 조회
    console.log('\n🔟 학생 개인 통계 조회 테스트');
    api.defaults.headers.common['Authorization'] = `Bearer ${studentToken}`;
    
    const myRecords = await api.get('/api/attendance/my-records');
    console.log('✅ 개인 출석 기록 조회 성공');
    
    const myStats = await api.get('/api/attendance/my-stats');
    console.log('✅ 개인 출석 통계 조회 성공');
    
    console.log('\n🎉 모든 통합 테스트 성공!');
    
    // 결과 요약
    console.log('\n📊 테스트 결과 요약:');
    console.log(`- 생성된 강의: ${testCourse.name} (${testCourse.course_code})`);
    console.log(`- 생성된 세션: ${sessionId}`);
    console.log(`- 출석 체크 완료: ${testStudent.name} (${testStudent.student_id})`);
    console.log(`- 통계 데이터: ${myStats.data.data.totalStats.attendanceRate}% 출석률`);
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.response?.data || error.message);
    process.exit(1);
  }
};

// 스크립트 실행
if (require.main === module) {
  console.log('🚀 백엔드 서버가 http://localhost:5000에서 실행 중인지 확인해주세요.\n');
  runTests().catch(console.error);
}

module.exports = { runTests };