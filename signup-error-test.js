const { chromium } = require('playwright');

async function testSignupRuntimeError() {
  console.log('🚀 회원가입 런타임 에러 테스트 시작 - ULTRATHINK 디버깅 방법론 적용');
  console.log('='.repeat(80));
  
  const browser = await chromium.launch({ 
    headless: false, // 브라우저를 보이게 설정
    slowMo: 1000,    // 각 액션 사이에 1초 대기
    devtools: true   // 개발자 도구 열기
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // 콘솔 로그 수집 설정 (ULTRATHINK 방법론)
  const consoleLogs = [];
  const errorLogs = [];
  const warningLogs = [];
  
  page.on('console', msg => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    };
    
    consoleLogs.push(logEntry);
    
    if (msg.type() === 'error') {
      errorLogs.push(logEntry);
      console.log(`🚨 [${timestamp}] [ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      warningLogs.push(logEntry);
      console.log(`⚠️ [${timestamp}] [WARNING] ${msg.text()}`);
    } else {
      console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  
  // 페이지 에러 감지
  page.on('pageerror', error => {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      timestamp,
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      location: { url: page.url() }
    };
    
    errorLogs.push(errorEntry);
    console.log(`💥 [${timestamp}] [PAGE_ERROR] ${error.message}`);
    
    // 무한 루프 감지
    if (error.message.includes('Maximum update depth') || 
        error.message.includes('Too many re-renders')) {
      console.log('🚨 무한 렌더링 루프 감지!');
    }
  });
  
  // 네트워크 오류 감지
  page.on('requestfailed', request => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [NETWORK_ERROR] ${request.method()} ${request.url()} - ${request.failure().errorText}`);
  });
  
  try {
    console.log('📍 STEP 1: http://localhost:3007 접속 시도');
    await page.goto('http://localhost:3007', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    console.log('✅ STEP 1 완료: 페이지 로드 성공');
    
    // 페이지 제목 확인
    const title = await page.title();
    console.log(`📖 페이지 제목: ${title}`);
    
    // 초기 페이지 스크린샷 저장
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\signup-test-01-initial.png',
      fullPage: true 
    });
    console.log('📸 초기 페이지 스크린샷 저장 완료');
    
    console.log('\n📍 STEP 2: 회원가입 링크 찾기 및 클릭');
    
    // 회원가입 링크 대기 및 확인 (여러 가능한 텍스트로 검색)
    let signupLink = null;
    const signupTexts = ['회원가입', '가입하기', '계정 만들기', 'Sign Up', 'Register'];
    
    for (const text of signupTexts) {
      try {
        signupLink = await page.waitForSelector(`text=${text}`, { timeout: 3000 });
        if (signupLink) {
          console.log(`✅ 회원가입 링크 발견: "${text}"`);
          break;
        }
      } catch (e) {
        console.log(`❌ "${text}" 링크 찾을 수 없음`);
      }
    }
    
    if (!signupLink) {
      // 링크를 찾을 수 없으면 href로 검색
      try {
        signupLink = await page.waitForSelector('a[href*="signup"], a[href*="register"]', { timeout: 5000 });
        console.log('✅ href로 회원가입 링크 발견');
      } catch (e) {
        throw new Error('회원가입 링크를 찾을 수 없습니다');
      }
    }
    
    // 회원가입 링크 클릭
    await signupLink.click();
    console.log('✅ STEP 2 완료: 회원가입 링크 클릭');
    
    // 페이지 로딩 대기
    await page.waitForTimeout(2000);
    
    // 회원가입 페이지 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\signup-test-02-signup-page.png',
      fullPage: true 
    });
    console.log('📸 회원가입 페이지 스크린샷 저장 완료');
    
    console.log('\n📍 STEP 3: 회원가입 폼 작성');
    
    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`🌐 현재 URL: ${currentUrl}`);
    
    // 학생 계정 선택 (라디오 버튼 또는 셀렉트 박스)
    console.log('🎯 학생 계정 선택 시도...');
    try {
      // 라디오 버튼으로 학생 선택 시도
      const studentRadio = await page.waitForSelector('input[type="radio"][value="student"], input[type="radio"] + label:has-text("학생")', { timeout: 5000 });
      if (studentRadio) {
        await studentRadio.click();
        console.log('✅ 학생 계정 라디오 버튼 선택 완료');
      }
    } catch (e) {
      // 셀렉트 박스로 학생 선택 시도
      try {
        const roleSelect = await page.waitForSelector('select[name*="role"], select[name*="type"]', { timeout: 3000 });
        if (roleSelect) {
          await roleSelect.selectOption('student');
          console.log('✅ 학생 계정 셀렉트 박스 선택 완료');
        }
      } catch (e2) {
        console.log('⚠️ 학생 계정 선택 요소를 찾을 수 없음 - 기본값으로 진행');
      }
    }
    
    // 이름 입력
    console.log('📝 이름 입력 시도...');
    const nameSelectors = [
      'input[name="name"]',
      'input[name="username"]', 
      'input[name="fullName"]',
      'input[id*="name"]',
      'input[placeholder*="이름"]'
    ];
    
    let nameField = null;
    for (const selector of nameSelectors) {
      try {
        nameField = await page.waitForSelector(selector, { timeout: 2000 });
        if (nameField) {
          await nameField.fill('테스트학생');
          console.log(`✅ 이름 입력 완료 (${selector})`);
          break;
        }
      } catch (e) {
        console.log(`❌ ${selector} 이름 필드 찾을 수 없음`);
      }
    }
    
    // 이메일 입력
    console.log('📧 이메일 입력 시도...');
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id*="email"]',
      'input[placeholder*="이메일"]'
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        emailField = await page.waitForSelector(selector, { timeout: 2000 });
        if (emailField) {
          await emailField.fill('test@university.ac.kr');
          console.log(`✅ 이메일 입력 완료 (${selector})`);
          break;
        }
      } catch (e) {
        console.log(`❌ ${selector} 이메일 필드 찾을 수 없음`);
      }
    }
    
    // 학번 입력
    console.log('🎓 학번 입력 시도...');
    const studentIdSelectors = [
      'input[name="studentId"]',
      'input[name="student_id"]',
      'input[name="studentNumber"]',
      'input[id*="student"]',
      'input[placeholder*="학번"]'
    ];
    
    let studentIdField = null;
    for (const selector of studentIdSelectors) {
      try {
        studentIdField = await page.waitForSelector(selector, { timeout: 2000 });
        if (studentIdField) {
          await studentIdField.fill('2024001');
          console.log(`✅ 학번 입력 완료 (${selector})`);
          break;
        }
      } catch (e) {
        console.log(`❌ ${selector} 학번 필드 찾을 수 없음`);
      }
    }
    
    // 비밀번호 입력
    console.log('🔒 비밀번호 입력 시도...');
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
      'input[placeholder*="비밀번호"]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        passwordField = await page.waitForSelector(selector, { timeout: 2000 });
        if (passwordField) {
          await passwordField.fill('Password123!');
          console.log(`✅ 비밀번호 입력 완료 (${selector})`);
          break;
        }
      } catch (e) {
        console.log(`❌ ${selector} 비밀번호 필드 찾을 수 없음`);
      }
    }
    
    // 비밀번호 확인 입력
    console.log('🔒 비밀번호 확인 입력 시도...');
    const confirmPasswordSelectors = [
      'input[name="confirmPassword"]',
      'input[name="confirm_password"]',
      'input[name="passwordConfirm"]',
      'input[id*="confirm"]',
      'input[placeholder*="확인"]'
    ];
    
    let confirmPasswordField = null;
    for (const selector of confirmPasswordSelectors) {
      try {
        confirmPasswordField = await page.waitForSelector(selector, { timeout: 2000 });
        if (confirmPasswordField) {
          await confirmPasswordField.fill('Password123!');
          console.log(`✅ 비밀번호 확인 입력 완료 (${selector})`);
          break;
        }
      } catch (e) {
        console.log(`❌ ${selector} 비밀번호 확인 필드 찾을 수 없음`);
      }
    }
    
    // 폼 작성 완료 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\signup-test-03-form-filled.png',
      fullPage: true 
    });
    console.log('📸 폼 작성 완료 스크린샷 저장 완료');
    
    console.log('\n📍 STEP 4: 계정 생성 버튼 클릭');
    
    // 제출 버튼 찾기 및 클릭
    const submitTexts = ['계정 생성', '가입하기', '회원가입', 'Sign Up', 'Register', 'Create Account'];
    let submitButton = null;
    
    for (const text of submitTexts) {
      try {
        submitButton = await page.waitForSelector(`button:has-text("${text}"), input[type="submit"][value*="${text}"]`, { timeout: 2000 });
        if (submitButton) {
          console.log(`✅ 제출 버튼 발견: "${text}"`);
          break;
        }
      } catch (e) {
        console.log(`❌ "${text}" 버튼 찾을 수 없음`);
      }
    }
    
    if (!submitButton) {
      // 일반적인 제출 버튼으로 검색
      try {
        submitButton = await page.waitForSelector('button[type="submit"], input[type="submit"]', { timeout: 5000 });
        console.log('✅ 일반 제출 버튼 발견');
      } catch (e) {
        throw new Error('제출 버튼을 찾을 수 없습니다');
      }
    }
    
    // 에러 감지를 위한 준비
    let runtimeErrorDetected = false;
    const errorCountBefore = errorLogs.length;
    
    console.log(`🚨 에러 감지 준비 완료 (현재 에러 수: ${errorCountBefore})`);
    
    // 계정 생성 버튼 클릭
    await submitButton.click();
    console.log('✅ STEP 4 완료: 계정 생성 버튼 클릭');
    
    console.log('\n📍 STEP 5: 런타임 에러 감지 및 결과 확인');
    
    // 에러 발생 대기 (5초간 모니터링)
    console.log('🔍 5초간 런타임 에러 감지 중...');
    await page.waitForTimeout(5000);
    
    const errorCountAfter = errorLogs.length;
    const newErrors = errorLogs.slice(errorCountBefore);
    
    if (newErrors.length > 0) {
      runtimeErrorDetected = true;
      console.log(`🚨 런타임 에러 감지! 새로운 에러 ${newErrors.length}개 발생`);
    } else {
      console.log('✅ 런타임 에러 감지되지 않음');
    }
    
    // 현재 URL 및 페이지 상태 확인
    const finalUrl = page.url();
    console.log(`🌐 최종 URL: ${finalUrl}`);
    
    // 성공/실패/에러 상태 판단
    if (finalUrl.includes('/success') || finalUrl.includes('/dashboard') || finalUrl.includes('/login')) {
      console.log('🎉 회원가입 처리 완료 (성공 또는 리다이렉트)');
    } else if (finalUrl.includes('/signup') || finalUrl.includes('/register')) {
      console.log('⚠️ 회원가입 페이지에 남아있음 (에러 또는 검증 실패 가능성)');
    } else {
      console.log('🤔 예상치 못한 페이지로 이동');
    }
    
    // 최종 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\signup-test-04-final-result.png',
      fullPage: true 
    });
    console.log('📸 최종 결과 스크린샷 저장 완료');
    
    // 에러 메시지 확인
    try {
      const errorMessage = await page.$('.ant-alert-error, .error-message, .alert-danger');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log(`🚨 페이지 에러 메시지: ${errorText}`);
      }
    } catch (e) {
      console.log('ℹ️ 페이지 에러 메시지 없음');
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
    
    // 오류 발생 시 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\signup-test-error.png',
      fullPage: true 
    });
    console.log('📸 오류 발생 시 스크린샷 저장 완료');
    
    // 페이지 소스 저장
    const pageContent = await page.content();
    require('fs').writeFileSync('C:\\Users\\gyb07\\workspace\\attendance-management\\signup-page-source-error.html', pageContent);
    console.log('📄 오류 발생 시 페이지 소스 저장 완료');
    
  } finally {
    console.log('\n📍 STEP 6: ULTRATHINK 디버깅 - 콘솔 로그 분석');
    console.log('='.repeat(50));
    
    // 전체 콘솔 로그 요약
    console.log(`📊 수집된 전체 로그: ${consoleLogs.length}개`);
    console.log(`❌ 에러 로그: ${errorLogs.length}개`);
    console.log(`⚠️ 경고 로그: ${warningLogs.length}개`);
    
    // 에러 로그 상세 분석
    if (errorLogs.length > 0) {
      console.log('\n🚨 === 발견된 에러들 ===');
      errorLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
        if (log.location && log.location.url) {
          console.log(`   📍 위치: ${log.location.url}:${log.location.lineNumber}:${log.location.columnNumber}`);
        }
        if (log.stack) {
          console.log(`   📋 스택 트레이스: ${log.stack.split('\n')[0]}`);
        }
      });
      
      // 특정 에러 패턴 분석
      const infiniteLoopErrors = errorLogs.filter(log => 
        log.text.includes('Maximum update depth') || 
        log.text.includes('Too many re-renders')
      );
      
      const networkErrors = errorLogs.filter(log => 
        log.text.includes('network') || 
        log.text.includes('fetch') ||
        log.text.includes('404') ||
        log.text.includes('500')
      );
      
      const reactErrors = errorLogs.filter(log => 
        log.text.includes('React') || 
        log.text.includes('hook') ||
        log.text.includes('component')
      );
      
      if (infiniteLoopErrors.length > 0) {
        console.log(`\n🔄 무한 루프 관련 에러: ${infiniteLoopErrors.length}개`);
      }
      
      if (networkErrors.length > 0) {
        console.log(`\n🌐 네트워크 관련 에러: ${networkErrors.length}개`);
      }
      
      if (reactErrors.length > 0) {
        console.log(`\n⚛️ React 관련 에러: ${reactErrors.length}개`);
      }
      
    } else {
      console.log('\n✅ 에러 로그 없음');
    }
    
    // 경고 로그 분석
    if (warningLogs.length > 0) {
      console.log('\n⚠️ === 발견된 경고들 ===');
      warningLogs.slice(0, 5).forEach((log, index) => {
        console.log(`${index + 1}. ${log.text}`);
      });
      if (warningLogs.length > 5) {
        console.log(`... 및 ${warningLogs.length - 5}개 더`);
      }
    }
    
    console.log('\n📍 테스트 종료');
    console.log('브라우저를 5초 후에 닫습니다...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('✅ 브라우저 종료 완료');
  }
  
  console.log('\n🏁 회원가입 런타임 에러 테스트 완료');
  console.log('='.repeat(80));
  
  // ULTRATHINK 결론 도출
  const hasRuntimeErrors = errorLogs.length > 0;
  const hasInfiniteLoop = errorLogs.some(log => 
    log.text.includes('Maximum update depth') || 
    log.text.includes('Too many re-renders')
  );
  
  return {
    success: !hasRuntimeErrors,
    totalErrors: errorLogs.length,
    totalWarnings: warningLogs.length,
    hasInfiniteLoop,
    errorLogs,
    warningLogs
  };
}

// 테스트 실행
testSignupRuntimeError().then(result => {
  console.log('\n🧠 ULTRATHINK 최종 분석 결과:');
  console.log('='.repeat(50));
  
  if (result.success) {
    console.log('✅ 결론: 회원가입 프로세스에서 런타임 에러 없음');
  } else {
    console.log('❌ 결론: 회원가입 프로세스에서 런타임 에러 발견');
    console.log(`   📊 총 ${result.totalErrors}개의 에러 발생`);
    
    if (result.hasInfiniteLoop) {
      console.log('   🔄 무한 렌더링 루프 감지됨');
    }
  }
  
  if (result.totalWarnings > 0) {
    console.log(`⚠️ 추가로 ${result.totalWarnings}개의 경고 발견`);
  }
  
  console.log('\n💡 권장 사항:');
  if (result.totalErrors > 0) {
    console.log('1. 발견된 에러 로그를 기반으로 코드 수정 필요');
    console.log('2. React 컴포넌트의 상태 관리 점검');
    console.log('3. API 요청 처리 로직 검토');
  } else {
    console.log('1. 현재 회원가입 프로세스는 안정적으로 작동');
    console.log('2. 정기적인 모니터링 권장');
  }
  
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('💥 테스트 실행 실패:', error);
  process.exit(1);
});