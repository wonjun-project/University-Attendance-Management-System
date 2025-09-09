const { chromium } = require('playwright');

async function ultrathinkDebugTest() {
  console.log('🧠 ULTRATHINK 디버깅 테스트 시작...');
  
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 500,
    devtools: true 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  
  // 콘솔 에러 및 무한 루프 감지
  const errors = [];
  const warnings = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(`❌ ${text}`);
      if (text.includes('Maximum update depth')) {
        console.log('🚨 무한 루프 감지!', text);
      }
    }
    if (msg.type() === 'warn') {
      warnings.push(`⚠️ ${text}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(`💥 Page Error: ${error.message}`);
    if (error.message.includes('Maximum update depth')) {
      console.log('🚨 페이지 무한 루프 감지!', error.message);
    }
  });

  try {
    console.log('1️⃣ 메인 페이지 접속 중...');
    await page.goto('http://localhost:3006', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    
    console.log('2️⃣ 5초간 무한 루프 감지 대기...');
    await page.waitForTimeout(5000);
    
    const screenshot1 = `screenshots/ultrathink-test-1-${Date.now()}.png`;
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`📸 스크린샷 저장: ${screenshot1}`);
    
    console.log('3️⃣ 페이지 네비게이션 테스트...');
    try {
      await page.click('text=로그인', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      const screenshot2 = `screenshots/ultrathink-test-2-${Date.now()}.png`;
      await page.screenshot({ path: screenshot2, fullPage: true });
      console.log(`📸 네비게이션 스크린샷: ${screenshot2}`);
    } catch (e) {
      console.log('ℹ️ 로그인 버튼 없음 - 이미 로그인된 상태일 수 있음');
    }
    
    console.log('4️⃣ 최종 안정성 체크...');
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('💥 테스트 실행 중 오류:', error.message);
    errors.push(`테스트 오류: ${error.message}`);
  }

  // 결과 분석
  console.log('\n📊 === ULTRATHINK 테스트 결과 ===');
  console.log(`❌ 에러 수: ${errors.length}`);
  console.log(`⚠️ 경고 수: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n🚨 발견된 에러들:');
    errors.slice(0, 5).forEach(error => console.log(error));
    if (errors.length > 5) {
      console.log(`... 및 ${errors.length - 5}개 더`);
    }
  }
  
  const hasInfiniteLoop = errors.some(err => err.includes('Maximum update depth'));
  
  if (hasInfiniteLoop) {
    console.log('\n💀 결론: 무한 루프 여전히 발생 중');
    return false;
  } else {
    console.log('\n✅ 결론: 무한 루프 감지되지 않음');
    return true;
  }

  await browser.close();
}

// 테스트 실행
ultrathinkDebugTest().then(success => {
  if (success) {
    console.log('🎉 가설 A 검증 성공!');
    process.exit(0);
  } else {
    console.log('❌ 가설 A 검증 실패 - 추가 조치 필요');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 테스트 실행 실패:', error);
  process.exit(1);
});