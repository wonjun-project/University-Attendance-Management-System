const { chromium } = require('playwright');

async function testProfessorLogin() {
  console.log('🚀 교수 계정 로그인 테스트 시작 - ULTRATHINK 디버깅 방법론 적용');
  console.log('='.repeat(80));
  
  const browser = await chromium.launch({ 
    headless: false, // 브라우저를 보이게 설정
    slowMo: 1000 // 각 액션 사이에 1초 대기
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 콘솔 로그 수집 설정
  const consoleLogs = [];
  page.on('console', msg => {
    const timestamp = new Date().toISOString();
    consoleLogs.push({
      timestamp,
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);
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
    
    // 페이지 스크린샷 저장
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\login-page-initial.png',
      fullPage: true 
    });
    console.log('📸 초기 페이지 스크린샷 저장 완료');
    
    console.log('\n📍 STEP 2: 교수 계정 데모 버튼 찾기 및 클릭');
    
    // 교수 계정 버튼 대기 및 확인
    const professorButton = await page.waitForSelector('text=교수 계정', { timeout: 10000 });
    if (!professorButton) {
      throw new Error('교수 계정 버튼을 찾을 수 없습니다');
    }
    console.log('✅ 교수 계정 버튼 발견');
    
    // 교수 계정 버튼 클릭
    await professorButton.click();
    console.log('✅ STEP 2 완료: 교수 계정 버튼 클릭');
    
    // 잠시 대기하여 폼이 채워지는 것을 확인
    await page.waitForTimeout(2000);
    
    // 이메일과 비밀번호 필드 값 확인
    const emailValue = await page.inputValue('#login_email');
    const passwordValue = await page.inputValue('#login_password');
    
    console.log(`📧 이메일 필드 값: ${emailValue}`);
    console.log(`🔒 비밀번호 필드 값: ${passwordValue ? '********' : '(비어있음)'}`);
    
    if (emailValue !== 'professor1@university.ac.kr') {
      console.log('⚠️  경고: 예상과 다른 이메일 값이 입력되었습니다');
    }
    
    if (!passwordValue) {
      console.log('⚠️  경고: 비밀번호가 입력되지 않았습니다');
    }
    
    // 데모 버튼 클릭 후 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\after-demo-button-click.png',
      fullPage: true 
    });
    console.log('📸 데모 버튼 클릭 후 스크린샷 저장 완료');
    
    console.log('\n📍 STEP 3: 로그인 버튼 클릭');
    
    // 로그인 버튼 찾기 및 클릭
    const loginButton = await page.waitForSelector('button[type="submit"], button:has-text("로그인")', { timeout: 10000 });
    if (!loginButton) {
      throw new Error('로그인 버튼을 찾을 수 없습니다');
    }
    console.log('✅ 로그인 버튼 발견');
    
    // 로그인 버튼 클릭
    await loginButton.click();
    console.log('✅ STEP 3 완료: 로그인 버튼 클릭');
    
    console.log('\n📍 STEP 4: 로그인 결과 확인');
    
    // 로그인 처리 대기 (최대 10초)
    await page.waitForTimeout(5000);
    
    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`🌐 현재 URL: ${currentUrl}`);
    
    // 성공/실패 판단
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/professor')) {
      console.log('🎉 로그인 성공! 대시보드로 리다이렉트되었습니다');
      
      // 성공 페이지 스크린샷
      await page.screenshot({ 
        path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\login-success.png',
        fullPage: true 
      });
      console.log('📸 로그인 성공 스크린샷 저장 완료');
      
    } else if (currentUrl.includes('/login') || currentUrl === 'http://localhost:3007/') {
      console.log('❌ 로그인 실패! 로그인 페이지에 남아있습니다');
      
      // 에러 메시지 확인
      const errorAlert = await page.$('.ant-alert-error');
      if (errorAlert) {
        const errorText = await errorAlert.textContent();
        console.log(`🚨 에러 메시지: ${errorText}`);
      }
      
      // 실패 페이지 스크린샷
      await page.screenshot({ 
        path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\login-failure.png',
        fullPage: true 
      });
      console.log('📸 로그인 실패 스크린샷 저장 완료');
      
    } else {
      console.log('🤔 예상치 못한 페이지로 이동했습니다');
      
      // 예상치 못한 결과 스크린샷
      await page.screenshot({ 
        path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\unexpected-result.png',
        fullPage: true 
      });
      console.log('📸 예상치 못한 결과 스크린샷 저장 완료');
    }
    
    console.log('\n📍 STEP 5: 콘솔 로그 분석');
    console.log('='.repeat(50));
    console.log('수집된 콘솔 로그:');
    
    if (consoleLogs.length === 0) {
      console.log('콘솔 로그가 없습니다.');
    } else {
      consoleLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type.toUpperCase()}] ${log.text}`);
        if (log.location.url) {
          console.log(`   위치: ${log.location.url}:${log.location.lineNumber}:${log.location.columnNumber}`);
        }
      });
    }
    
    // 에러 로그만 필터링
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    if (errorLogs.length > 0) {
      console.log('\n🚨 에러 로그:');
      errorLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.text}`);
      });
    }
    
    // 경고 로그만 필터링
    const warningLogs = consoleLogs.filter(log => log.type === 'warning');
    if (warningLogs.length > 0) {
      console.log('\n⚠️  경고 로그:');
      warningLogs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.text}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
    
    // 오류 발생 시 스크린샷
    await page.screenshot({ 
      path: 'C:\\Users\\gyb07\\workspace\\attendance-management\\screenshots\\test-error.png',
      fullPage: true 
    });
    console.log('📸 오류 발생 시 스크린샷 저장 완료');
    
    // 페이지 소스 저장
    const pageContent = await page.content();
    require('fs').writeFileSync('C:\\Users\\gyb07\\workspace\\attendance-management\\page-source-error.html', pageContent);
    console.log('📄 오류 발생 시 페이지 소스 저장 완료');
    
  } finally {
    console.log('\n📍 테스트 종료');
    console.log('브라우저를 5초 후에 닫습니다...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('✅ 브라우저 종료 완료');
  }
  
  console.log('\n🏁 교수 계정 로그인 테스트 완료');
  console.log('='.repeat(80));
}

// 테스트 실행
testProfessorLogin().catch(console.error);