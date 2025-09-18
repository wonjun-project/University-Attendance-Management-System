const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase 클라이언트 생성
const supabase = createClient(
  'https://flmkocjijnzlxbzcmskh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWtvY2ppam56bHhiemNtc2toIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ3MDM2MywiZXhwIjoyMDczMDQ2MzYzfQ.If_pD3XgkA1f9KJ8ziNQYdBx9Zd09xApOYyWzPPp6Tg'
);

async function applyMigration() {
  try {
    // Migration SQL 파일 읽기
    const migrationPath = path.join(__dirname, 'database/migrations/008_add_classroom_location_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 migration 적용 중...');
    console.log('SQL:', migrationSQL);

    // SQL 실행
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    });

    if (error) {
      // exec_sql 함수가 없을 수 있으므로 직접 실행
      console.log('⚠️ exec_sql 함수가 없습니다. 직접 실행을 시도합니다.');

      // SQL 문장을 세미콜론으로 나누어 개별 실행
      const statements = migrationSQL.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (!statement.trim()) continue;

        try {
          // Supabase의 from을 사용한 raw SQL은 지원되지 않으므로
          // 각 명령을 개별적으로 처리해야 함
          console.log('실행 중:', statement.substring(0, 50) + '...');

          // 여기서는 수동으로 migration을 적용해야 함
          console.log('⚠️ Supabase 대시보드에서 다음 SQL을 실행하세요:');
          console.log(statement + ';');
          console.log('---');
        } catch (stmtError) {
          console.error('문장 실행 오류:', stmtError);
        }
      }

      return;
    }

    console.log('✅ Migration 성공적으로 적용됨');
    console.log('결과:', data);

  } catch (err) {
    console.error('❌ Migration 적용 실패:', err);
  }
}

// 테이블 구조 확인
async function checkTableStructure() {
  try {
    console.log('\n📊 현재 class_sessions 테이블 구조 확인 중...');

    // 테스트 쿼리로 컬럼 존재 여부 확인
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id, classroom_latitude, classroom_longitude, classroom_radius')
      .limit(1);

    if (error) {
      if (error.message.includes('classroom_latitude')) {
        console.log('❌ classroom_latitude 컬럼이 존재하지 않습니다.');
        console.log('⚠️ Migration이 필요합니다.');
        console.log('\n다음 단계를 따르세요:');
        console.log('1. Supabase 대시보드에 로그인: https://supabase.com/dashboard');
        console.log('2. 프로젝트 선택: flmkocjijnzlxbzcmskh');
        console.log('3. SQL Editor로 이동');
        console.log('4. 위에 출력된 SQL 명령을 실행');
      } else {
        console.error('테이블 확인 오류:', error);
      }
    } else {
      console.log('✅ classroom_latitude, classroom_longitude, classroom_radius 컬럼이 이미 존재합니다.');
      console.log('샘플 데이터:', data);
    }

  } catch (err) {
    console.error('❌ 테이블 구조 확인 실패:', err);
  }
}

// 실행
async function main() {
  console.log('🚀 Migration 스크립트 시작...\n');
  await applyMigration();
  await checkTableStructure();
  console.log('\n✅ 스크립트 완료');
}

main();