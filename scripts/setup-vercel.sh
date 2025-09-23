#!/bin/bash

echo "🚀 Vercel 프로젝트 설정 스크립트"
echo "================================"
echo ""
echo "이 스크립트는 Vercel 프로젝트를 연결하고 GitHub Secrets 설정을 도와줍니다."
echo ""

# Vercel CLI 설치 확인
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI를 설치합니다..."
    npm i -g vercel@latest
fi

echo "📝 Vercel에 로그인합니다..."
vercel login

echo ""
echo "🔗 프로젝트를 Vercel과 연결합니다..."
echo "다음 질문에 답해주세요:"
echo ""

# Vercel 프로젝트 연결 (새 프로젝트 생성 또는 기존 프로젝트 연결)
vercel link

# .vercel/project.json 파일이 생성되었는지 확인
if [ -f ".vercel/project.json" ]; then
    echo ""
    echo "✅ Vercel 프로젝트가 성공적으로 연결되었습니다!"
    echo ""

    # project.json 파일 읽기
    PROJECT_ID=$(cat .vercel/project.json | grep '"projectId"' | cut -d'"' -f4)
    ORG_ID=$(cat .vercel/project.json | grep '"orgId"' | cut -d'"' -f4)

    echo "📋 GitHub Secrets에 설정할 값:"
    echo "================================"
    echo "VERCEL_PROJECT_ID=$PROJECT_ID"
    echo "VERCEL_ORG_ID=$ORG_ID"
    echo ""
    echo "🔑 VERCEL_TOKEN 생성 방법:"
    echo "1. https://vercel.com/account/tokens 방문"
    echo "2. 'Create' 버튼 클릭"
    echo "3. 토큰 이름 입력 (예: github-actions)"
    echo "4. 'Full Access' 스코프 선택"
    echo "5. 생성된 토큰 복사"
    echo ""
    echo "⚙️ GitHub Secrets 설정 방법:"
    echo "1. GitHub 저장소 페이지로 이동"
    echo "2. Settings > Secrets and variables > Actions"
    echo "3. 'New repository secret' 클릭"
    echo "4. 위의 세 가지 값을 각각 추가:"
    echo "   - VERCEL_PROJECT_ID"
    echo "   - VERCEL_ORG_ID"
    echo "   - VERCEL_TOKEN"
    echo ""
    echo "📌 중요: .vercel 디렉터리는 .gitignore에 추가되어 있어야 합니다."

    # .gitignore 확인
    if ! grep -q "^\.vercel" .gitignore 2>/dev/null; then
        echo ".vercel" >> .gitignore
        echo "✅ .gitignore에 .vercel 추가됨"
    fi
else
    echo "❌ Vercel 프로젝트 연결에 실패했습니다."
    echo "   다시 시도해주세요: vercel link"
fi

echo ""
echo "🎯 다음 단계:"
echo "1. GitHub Secrets 설정 완료"
echo "2. git push로 자동 배포 테스트"
echo "3. GitHub Actions 탭에서 배포 상태 확인"