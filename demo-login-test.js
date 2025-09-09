// 데모 로그인 테스트 스크립트
const test_demo_login = async () => {
  console.log('🎯 데모 로그인 테스트 시작');
  
  try {
    // 학생 계정 테스트
    console.log('\n📚 학생 계정 테스트...');
    const studentResponse = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'student1@university.ac.kr',
        password: 'password123'
      })
    });
    
    const studentResult = await studentResponse.json();
    console.log('📊 학생 로그인 결과:', {
      status: studentResponse.status,
      result: studentResult
    });

    // 교수 계정 테스트  
    console.log('\n👨‍🏫 교수 계정 테스트...');
    const professorResponse = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'professor1@university.ac.kr', 
        password: 'password123'
      })
    });
    
    const professorResult = await professorResponse.json();
    console.log('📊 교수 로그인 결과:', {
      status: professorResponse.status,
      result: professorResult
    });

    // 잘못된 계정 테스트
    console.log('\n❌ 잘못된 계정 테스트...');
    const wrongResponse = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'wrong@test.com',
        password: 'wrongpass'
      })
    });
    
    const wrongResult = await wrongResponse.json();
    console.log('📊 잘못된 계정 로그인 결과:', {
      status: wrongResponse.status,
      result: wrongResult
    });

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
};

// 프론트엔드 데모 로그인 시뮬레이션 테스트
const test_frontend_demo = () => {
  console.log('\n🌐 프론트엔드 데모 로그인 시뮬레이션 테스트');
  
  const demoAccounts = {
    'student1@university.ac.kr': { role: 'student', name: '김학생', studentId: 'STU001' },
    'professor1@university.ac.kr': { role: 'professor', name: '이교수' }
  };

  const credentials = { email: 'student1@university.ac.kr', password: 'password123' };
  const demoUser = demoAccounts[credentials.email];
  
  console.log('🔍 데모 계정 검색:', {
    email: credentials.email,
    password: credentials.password,
    foundUser: demoUser,
    isValid: demoUser && credentials.password === 'password123'
  });
  
  if (demoUser && credentials.password === 'password123') {
    const fakeUser = {
      id: 'demo_' + demoUser.role,
      email: credentials.email,
      name: demoUser.name,
      role: demoUser.role,
      phone: '010-1234-5678',
      ...(demoUser.role === 'student' && { studentId: demoUser.studentId })
    };
    
    console.log('✅ 데모 로그인 성공:', fakeUser);
  } else {
    console.log('❌ 데모 로그인 실패');
  }
};

// 테스트 실행
test_demo_login();
test_frontend_demo();

console.log('\n📋 요약:');
console.log('- 백엔드 API는 실제 데이터베이스 계정이 필요함');
console.log('- 프론트엔드는 데모 로그인 시뮬레이션 사용');
console.log('- 사용자는 웹사이트에서 데모 버튼 클릭 후 로그인 버튼을 눌러야 함');