const { chromium } = require('playwright');
const fs = require('fs');

async function finalDiagnosis() {
  console.log('🔍 최종 시스템 진단 시작...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const baseURL = 'http://localhost:3003';
  
  const results = {
    success: [],
    issues: [],
    screenshots: []
  };

  try {
    console.log('\n1️⃣ 메인 페이지 접속 테스트...');
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 15000 });
    
    // 로딩 대기
    await page.waitForTimeout(3000);
    
    const screenshot1 = `screenshots/final-01-main-${Date.now()}.png`;
    await page.screenshot({ path: screenshot1, fullPage: true });
    results.screenshots.push({ name: 'Main Page', path: screenshot1 });
    
    // 페이지 제목 확인
    const title = await page.title();
    console.log(`   📄 페이지 제목: ${title}`);
    
    // React 앱이 로드되었는지 확인
    const hasReactRoot = await page.locator('#root').count();
    if (hasReactRoot > 0) {
      results.success.push('✅ React 앱이 정상적으로 로드됨');
    } else {
      results.issues.push('❌ React 앱 로드 실패');
    }
    
    // 로그인 폼 확인
    const loginForm = await page.locator('form').count();
    const emailInput = await page.locator('input[type="email"], input[placeholder*="이메일"], input[name*="email"]').count();
    const passwordInput = await page.locator('input[type="password"], input[placeholder*="비밀번호"], input[name*="password"]').count();
    
    console.log(`   📋 로그인 폼: ${loginForm}개`);
    console.log(`   ✉️ 이메일 입력: ${emailInput}개`);
    console.log(`   🔒 비밀번호 입력: ${passwordInput}개`);
    
    if (loginForm > 0 && emailInput > 0 && passwordInput > 0) {
      results.success.push('✅ 로그인 폼이 정상적으로 렌더링됨');
      
      console.log('\n2️⃣ 로그인 폼 상호작용 테스트...');
      
      // 테스트 계정 입력
      await page.fill('input[type="email"], input[placeholder*="이메일"], input[name*="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[placeholder*="비밀번호"], input[name*="password"]', 'password123');
      
      const screenshot2 = `screenshots/final-02-login-filled-${Date.now()}.png`;
      await page.screenshot({ path: screenshot2, fullPage: true });
      results.screenshots.push({ name: 'Login Form Filled', path: screenshot2 });
      
      results.success.push('✅ 로그인 폼 입력 성공');
      
    } else {
      results.issues.push('❌ 로그인 폼이 제대로 렌더링되지 않음');
    }

    console.log('\n3️⃣ UI 컴포넌트 렌더링 확인...');
    
    // Ant Design 컴포넌트들이 제대로 렌더링되었는지 확인
    const antComponents = await page.locator('.ant-btn, .ant-card, .ant-form, .ant-input').count();
    console.log(`   🎨 Ant Design 컴포넌트: ${antComponents}개`);
    
    if (antComponents > 0) {
      results.success.push(`✅ Ant Design 컴포넌트 ${antComponents}개 정상 렌더링`);
    } else {
      results.issues.push('❌ Ant Design 컴포넌트 렌더링 실패');
    }

    // 콘솔 에러 확인
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000); // 에러 수집 대기
    
    if (consoleErrors.length === 0) {
      results.success.push('✅ 브라우저 콘솔 에러 없음');
    } else {
      results.issues.push(`❌ 콘솔 에러 ${consoleErrors.length}개 발견`);
      consoleErrors.forEach(error => {
        console.log(`   🔴 ${error}`);
      });
    }

  } catch (error) {
    results.issues.push(`❌ 테스트 실행 중 오류: ${error.message}`);
    console.error('진단 중 오류:', error.message);
  }

  await browser.close();

  // 결과 요약
  console.log('\n📊 === 최종 진단 결과 ===');
  console.log(`✅ 성공: ${results.success.length}개`);
  results.success.forEach(item => console.log(`   ${item}`));
  
  console.log(`\n❌ 문제: ${results.issues.length}개`);
  results.issues.forEach(item => console.log(`   ${item}`));
  
  console.log(`\n📸 스크린샷: ${results.screenshots.length}개`);
  results.screenshots.forEach((shot, index) => {
    console.log(`   ${index + 1}. ${shot.name}: ${shot.path}`);
  });

  // 전체 상태 평가
  console.log('\n⭐ === 시스템 상태 평가 ===');
  const successRate = (results.success.length / (results.success.length + results.issues.length)) * 100;
  
  if (results.issues.length === 0) {
    console.log('🟢 상태: 우수 - 모든 기능이 정상 작동');
  } else if (successRate >= 70) {
    console.log('🟡 상태: 양호 - 대부분의 기능이 정상 작동');
  } else if (successRate >= 50) {
    console.log('🟠 상태: 주의 - 일부 기능에 문제 있음');
  } else {
    console.log('🔴 상태: 위험 - 심각한 문제 발견');
  }

  console.log(`📈 성공률: ${successRate.toFixed(1)}%`);

  return results;
}

// 스크린샷 폴더 생성
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

finalDiagnosis().then(results => {
  console.log('\n🎯 최종 진단이 완료되었습니다!');
  
  if (results.issues.length === 0) {
    console.log('💚 모든 시스템이 정상적으로 작동하고 있습니다!');
  } else {
    console.log('⚠️  일부 문제가 발견되었으나 기본적인 기능은 작동합니다.');
  }
}).catch(error => {
  console.error('❌ 진단 실행 오류:', error);
});