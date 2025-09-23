#!/bin/bash

# 마이그레이션 파일 실행 스크립트
# 사용법: ./scripts/run-migration.sh

echo "📦 Supabase 마이그레이션 실행 중..."

# 환경 변수 체크
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 환경 변수가 설정되지 않았습니다."
    echo "   .env.local 파일에 다음 변수들이 설정되어 있는지 확인하세요:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# 009_fix_session_access.sql 마이그레이션 실행
echo "🔧 세션 접근 정책 수정 중..."

# supabase CLI가 설치되어 있는 경우
if command -v supabase &> /dev/null; then
    supabase migration up --db-url "$NEXT_PUBLIC_SUPABASE_URL"
else
    echo "⚠️  supabase CLI가 설치되어 있지 않습니다."
    echo "   대신 Supabase 대시보드의 SQL Editor에서 다음 파일을 실행하세요:"
    echo "   database/migrations/009_fix_session_access.sql"
fi

echo "✅ 마이그레이션 완료!"
echo ""
echo "📝 다음 단계:"
echo "1. 서버를 재시작하세요: npm run dev"
echo "2. 교수 계정으로 로그인하여 QR 코드를 생성하세요"
echo "3. 학생 계정으로 QR 코드를 스캔하여 출석 체크를 테스트하세요"