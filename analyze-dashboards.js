const { chromium } = require('playwright');

async function analyzeDashboards() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const dashboards = [
    { name: 'Vercel', url: 'https://vercel.com/dashboard' },
    { name: 'Linear', url: 'https://linear.app' },
    { name: 'Stripe', url: 'https://dashboard.stripe.com' },
    { name: 'GitHub', url: 'https://github.com' },
    { name: 'Supabase', url: 'https://supabase.com/dashboard' },
    { name: 'Railway', url: 'https://railway.app/dashboard' },
    { name: 'Figma', url: 'https://www.figma.com' },
    { name: 'Notion', url: 'https://www.notion.so' },
  ];

  const analysis = [];

  for (const dashboard of dashboards) {
    try {
      console.log(`분석 중: ${dashboard.name} - ${dashboard.url}`);
      
      const page = await context.newPage();
      await page.goto(dashboard.url, { waitUntil: 'networkidle', timeout: 15000 });
      
      // 기본 색상 팔레트 분석
      const colors = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const colorSet = new Set();
        
        for (let element of elements) {
          const styles = window.getComputedStyle(element);
          const bgColor = styles.backgroundColor;
          const color = styles.color;
          const borderColor = styles.borderColor;
          
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            colorSet.add(bgColor);
          }
          if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            colorSet.add(color);
          }
          if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
            colorSet.add(borderColor);
          }
        }
        
        return Array.from(colorSet).slice(0, 10); // 상위 10개 색상
      });

      // 타이포그래피 분석
      const typography = await page.evaluate(() => {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const fonts = new Set();
        
        headings.forEach(heading => {
          const styles = window.getComputedStyle(heading);
          fonts.add(styles.fontFamily);
        });
        
        return {
          fonts: Array.from(fonts),
          headingCount: headings.length
        };
      });

      // 레이아웃 패턴 분석
      const layout = await page.evaluate(() => {
        const sidebar = document.querySelector('aside, nav, [class*="sidebar"]');
        const header = document.querySelector('header, [class*="header"]');
        const main = document.querySelector('main, [class*="main"]');
        
        return {
          hasSidebar: !!sidebar,
          hasHeader: !!header,
          hasMain: !!main,
          sidebarWidth: sidebar ? sidebar.offsetWidth : 0,
          headerHeight: header ? header.offsetHeight : 0
        };
      });

      // 버튼 스타일 분석
      const buttons = await page.evaluate(() => {
        const buttonElements = document.querySelectorAll('button, [role="button"], a[class*="button"]');
        const buttonStyles = [];
        
        for (let i = 0; i < Math.min(5, buttonElements.length); i++) {
          const btn = buttonElements[i];
          const styles = window.getComputedStyle(btn);
          buttonStyles.push({
            borderRadius: styles.borderRadius,
            padding: styles.padding,
            backgroundColor: styles.backgroundColor,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight
          });
        }
        
        return buttonStyles;
      });

      analysis.push({
        name: dashboard.name,
        url: dashboard.url,
        colors: colors,
        typography: typography,
        layout: layout,
        buttons: buttons,
        timestamp: new Date().toISOString()
      });

      await page.close();
      
      // 요청 간격을 두어 서버에 부담을 주지 않음
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`${dashboard.name} 분석 실패:`, error.message);
      analysis.push({
        name: dashboard.name,
        url: dashboard.url,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  await browser.close();
  return analysis;
}

// 분석 실행
analyzeDashboards().then(results => {
  console.log('\n=== 대시보드 디자인 분석 결과 ===');
  results.forEach(result => {
    console.log(`\n### ${result.name}`);
    if (result.error) {
      console.log(`❌ 오류: ${result.error}`);
    } else {
      console.log(`🎨 주요 색상: ${result.colors?.slice(0, 3).join(', ')}`);
      console.log(`📝 폰트: ${result.typography?.fonts?.[0] || 'N/A'}`);
      console.log(`📐 레이아웃: 사이드바(${result.layout?.hasSidebar ? 'O' : 'X'}), 헤더(${result.layout?.hasHeader ? 'O' : 'X'})`);
      if (result.buttons?.[0]) {
        console.log(`🔘 버튼 스타일: ${result.buttons[0].borderRadius}, ${result.buttons[0].backgroundColor}`);
      }
    }
  });
  
  // JSON 파일로 저장
  require('fs').writeFileSync('./dashboard-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n✅ 분석 결과를 dashboard-analysis.json에 저장했습니다.');
}).catch(console.error);