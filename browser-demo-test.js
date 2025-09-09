// 브라우저 시뮬레이션으로 실제 데모 로그인 테스트
const { chromium } = require('playwright');

async function testDemoLogin() {
  console.log('🎯 브라우저 시뮬레이션 데모 로그인 테스트 시작');
  
  // 브라우저 시작
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🌐 웹사이트 접속 중...');
    
    // 네트워크 요청 모니터링
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('api')) {
        requests.push({
          method: request.method(),
          url: request.url(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // 응답 모니터링
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('api')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // 콘솔 로그 모니터링
    page.on('console', msg => {
      if (msg.text().includes('데모') || msg.text().includes('로그인')) {
        console.log(`📝 브라우저 콘솔: ${msg.text()}`);
      }
    });

    // 페이지 로드
    await page.goto('http://localhost:3008');
    await page.waitForTimeout(2000);

    console.log('📄 페이지 제목:', await page.title());

    // 데모 계정 버튼 찾기
    const studentButton = await page.$('button:has-text("학생 계정")');
    const professorButton = await page.$('button:has-text("교수 계정")');
    const loginButton = await page.$('button[type="submit"]');

    if (studentButton && loginButton) {
      console.log('✅ 학생 데모 계정 버튼과 로그인 버튼 발견');

      // 학생 데모 계정 테스트
      console.log('🎓 학생 데모 계정 클릭...');
      await studentButton.click();
      await page.waitForTimeout(1000);

      // 폼 값 확인
      const emailValue = await page.$eval('input[name="email"]', el => el.value);
      const passwordValue = await page.$eval('input[name="password"]', el => el.value);
      
      console.log('📋 폼에 입력된 값:', {
        email: emailValue,
        password: passwordValue ? '***입력됨***' : '비어있음'
      });

      // 로그인 버튼 클릭
      console.log('🔓 로그인 버튼 클릭...');
      await loginButton.click();
      
      // 잠시 대기 후 결과 확인
      await page.waitForTimeout(3000);

      // 현재 URL 확인
      const currentUrl = page.url();
      console.log('🌐 현재 URL:', currentUrl);

      // 에러 메시지 확인
      const errorMessage = await page.$('.ant-alert-error');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log('❌ 에러 메시지:', errorText);
      }

      // 성공 시 대시보드 확인
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ 로그인 성공! 대시보드로 이동');
      }

    } else {
      console.log('❌ 데모 버튼 또는 로그인 버튼을 찾을 수 없음');
    }

    // 네트워크 요청/응답 로그
    console.log('\n📊 네트워크 요청/응답:');
    requests.forEach(req => {
      console.log(`→ ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`  데이터: ${req.postData}`);
      }
    });

    responses.forEach(res => {
      console.log(`← ${res.status} ${res.url}`);
    });

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  } finally {
    await page.waitForTimeout(5000); // 5초 대기 후 종료
    await browser.close();
  }
}

// 브라우저가 없을 때 대체 테스트
async function fallbackTest() {
  console.log('🔄 Playwright 없이 대체 테스트 진행');
  
  try {
    // 단순히 페이지 소스 가져오기
    const response = await fetch('http://localhost:3008');
    const html = await response.text();
    
    const hasStudentButton = html.includes('학생 계정');
    const hasProfessorButton = html.includes('교수 계정');
    const hasDemoSection = html.includes('데모 계정');
    
    console.log('📄 페이지 분석:', {
      hasStudentButton,
      hasProfessorButton,
      hasDemoSection,
      pageSize: html.length + ' characters'
    });
    
  } catch (error) {
    console.error('❌ 대체 테스트 실패:', error);
  }
}

// 테스트 실행
testDemoLogin().catch(() => {
  console.log('⚠️ Playwright 테스트 실패, 대체 테스트 실행');
  fallbackTest();
});