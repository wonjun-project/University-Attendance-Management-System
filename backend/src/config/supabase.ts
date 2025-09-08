import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 환경변수 검증
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL 환경변수가 설정되지 않았습니다.');
  console.error('💡 .env.development 파일에 다음을 추가하세요:');
  console.error('   SUPABASE_URL=https://your-project-id.supabase.co');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  console.error('💡 .env.development 파일에 다음을 추가하세요:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

// Supabase 클라이언트 생성 (서비스 롤 키 사용)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 데이터베이스 연결 테스트 함수
export const testConnection = async (): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Supabase 연결 테스트 실패:', error.message);
      return false;
    }

    console.log('✅ Supabase 연결 성공! 사용자 수:', count);
    return true;
  } catch (error) {
    console.error('❌ Supabase 연결 중 예외 발생:', error);
    return false;
  }
};

// 앱 시작 시 연결 테스트 실행
testConnection();