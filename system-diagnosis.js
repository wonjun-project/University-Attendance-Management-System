const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function diagnoseSystem() {
  console.log('🔍 출석 관리 시스템 종합 진단 시작...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  const page = await context.newPage();
  const baseURL = 'http://localhost:3003';
  
  const screenshots = [];
  const issues = [];
  
  console.log('\n📸 스크린샷 캡처 및 UI 진단 시작...');

  try {
    // 1. 메인 페이지 (로그인 페이지) 테스트
    console.log('1️⃣ 메인/로그인 페이지 테스트...');
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const loginScreenshot = `screenshots/01-login-page-${Date.now()}.png`;
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    screenshots.push({ page: 'Login Page', path: loginScreenshot });
    
    // 로그인 페이지 요소 확인
    const loginForm = await page.locator('form[name="login"]');
    const emailInput = await page.locator('input[type="email"]');
    const passwordInput = await page.locator('input[type="password"]');
    const loginButton = await page.locator('button[type="submit"]');
    
    console.log(`   ✅ 로그인 폼 존재: ${await loginForm.count() > 0}`);
    console.log(`   ✅ 이메일 입력 필드: ${await emailInput.count() > 0}`);
    console.log(`   ✅ 비밀번호 입력 필드: ${await passwordInput.count() > 0}`);
    console.log(`   ✅ 로그인 버튼: ${await loginButton.count() > 0}`);
    
    if (await loginForm.count() === 0) {
      issues.push('❌ 로그인 폼이 제대로 렌더링되지 않음');
    }

    // 2. 회원가입 페이지 이동 및 테스트
    console.log('\n2️⃣ 회원가입 페이지 테스트...');
    const registerLink = await page.locator('a:has-text("회원가입")');
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await page.waitForTimeout(2000);
      
      const registerScreenshot = `screenshots/02-register-page-${Date.now()}.png`;
      await page.screenshot({ path: registerScreenshot, fullPage: true });
      screenshots.push({ page: 'Register Page', path: registerScreenshot });
      
      const registerForm = await page.locator('form[name="register"]');
      console.log(`   ✅ 회원가입 폼 존재: ${await registerForm.count() > 0}`);
      
      if (await registerForm.count() === 0) {
        issues.push('❌ 회원가입 폼이 제대로 렌더링되지 않음');
      }
    } else {
      issues.push('❌ 회원가입 링크를 찾을 수 없음');
    }

    // 3. 테스트 계정으로 로그인 시도
    console.log('\n3️⃣ 테스트 로그인 시도...');
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // 테스트 로그인 정보 입력
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    const beforeLoginScreenshot = `screenshots/03-before-login-${Date.now()}.png`;
    await page.screenshot({ path: beforeLoginScreenshot, fullPage: true });
    screenshots.push({ page: 'Before Login', path: beforeLoginScreenshot });
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    const afterLoginScreenshot = `screenshots/04-after-login-${Date.now()}.png`;
    await page.screenshot({ path: afterLoginScreenshot, fullPage: true });
    screenshots.push({ page: 'After Login Attempt', path: afterLoginScreenshot });

    // 4. 현재 URL 및 페이지 상태 확인
    const currentURL = page.url();
    console.log(`   🔗 현재 URL: ${currentURL}`);
    
    if (currentURL.includes('/dashboard')) {
      console.log('   ✅ 대시보드로 성공적으로 이동됨');
      
      // 대시보드 요소들 확인
      const dashboardElements = await page.locator('.ant-card').count();
      console.log(`   📊 대시보드 카드 요소 수: ${dashboardElements}`);
      
      if (dashboardElements === 0) {
        issues.push('❌ 대시보드 컴포넌트가 제대로 렌더링되지 않음');
      }
    } else {
      issues.push('❌ 로그인 후 대시보드로 리다이렉트되지 않음');
    }

    // 5. 네비게이션 메뉴 테스트
    console.log('\n5️⃣ 네비게이션 메뉴 테스트...');
    const navMenu = await page.locator('.ant-menu');
    if (await navMenu.count() > 0) {
      console.log('   ✅ 네비게이션 메뉴 존재');
      
      const menuItems = await page.locator('.ant-menu-item').count();
      console.log(`   📋 메뉴 아이템 수: ${menuItems}`);
      
      if (menuItems === 0) {
        issues.push('❌ 네비게이션 메뉴 아이템이 없음');
      }
    } else {
      issues.push('❌ 네비게이션 메뉴가 렌더링되지 않음');
    }

    // 6. 콘솔 에러 확인
    console.log('\n6️⃣ 브라우저 콘솔 에러 확인...');
    const consoleLogs = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(`❌ Console Error: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      consoleLogs.push(`❌ Page Error: ${error.message}`);
    });
    
    // 네트워크 오류 확인
    page.on('requestfailed', request => {
      consoleLogs.push(`❌ Network Error: ${request.url()} - ${request.failure().errorText}`);
    });

    await page.waitForTimeout(3000); // 에러 로그 수집을 위한 대기
    
    if (consoleLogs.length > 0) {
      issues.push('❌ 브라우저 콘솔/네트워크 에러 발견');
      consoleLogs.forEach(log => console.log(`   ${log}`));
    } else {
      console.log('   ✅ 브라우저 콘솔 에러 없음');
    }

  } catch (error) {
    issues.push(`❌ 테스트 실행 중 오류: ${error.message}`);
    console.error('테스트 실행 중 오류:', error);
  }

  await browser.close();

  // 7. 진단 결과 요약
  console.log('\n📋 === 시스템 진단 결과 요약 ===');
  console.log(`📸 캡처된 스크린샷: ${screenshots.length}개`);
  screenshots.forEach((shot, index) => {
    console.log(`   ${index + 1}. ${shot.page}: ${shot.path}`);
  });
  
  console.log(`\n🚨 발견된 문제점: ${issues.length}개`);
  if (issues.length > 0) {
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('   ✅ 주요 문제점 없음');
  }

  // 8. 시스템 상태 평가
  console.log('\n⭐ === 전체 시스템 상태 평가 ===');
  if (issues.length === 0) {
    console.log('🟢 상태: 양호 - 시스템이 정상적으로 작동함');
  } else if (issues.length <= 3) {
    console.log('🟡 상태: 주의 - 일부 문제가 있으나 기본 기능은 작동');
  } else {
    console.log('🔴 상태: 위험 - 다수의 문제로 인해 정상적인 사용이 어려움');
  }

  return { screenshots, issues };
}

// 스크린샷 폴더 생성
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

diagnoseSystem().then(result => {
  console.log('\n🎉 시스템 진단이 완료되었습니다!');
}).catch(error => {
  console.error('진단 실행 오류:', error);
});