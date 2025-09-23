# Vercel 배포 오류 해결 가이드

## 문제 상황
GitHub Actions에서 Vercel 배포 시 다음 오류 발생:
```
Error: Project not found ({"VERCEL_PROJECT_ID":"***","VERCEL_ORG_ID":"***"})
```

## 원인 분석
1. **Vercel 프로젝트 미연결**: 로컬 프로젝트가 Vercel과 연결되지 않음
2. **잘못된 GitHub Secrets**: `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`가 실제 프로젝트와 불일치
3. **Vercel 토큰 문제**: 토큰이 없거나 권한 부족

## 해결 방법

### 방법 1: 자동 설정 스크립트 사용 (권장)

```bash
# 1. 스크립트 실행
./scripts/setup-vercel.sh

# 2. 스크립트 지시에 따라:
#    - Vercel 로그인
#    - 프로젝트 연결 (새 프로젝트 생성 또는 기존 연결)
#    - 표시되는 ID 값들을 GitHub Secrets에 추가
```

### 방법 2: 수동 설정

#### Step 1: Vercel CLI로 프로젝트 연결

```bash
# Vercel CLI 설치
npm i -g vercel@latest

# Vercel 로그인
vercel login

# 프로젝트 연결
vercel link

# 다음 질문에 답변:
# ? Set up and deploy "~/projects/University-Attendance-Management-System"? [Y/n] Y
# ? Which scope do you want to deploy to? (개인 계정 또는 팀 선택)
# ? Link to existing project? [y/N] (기존 프로젝트가 있으면 y, 없으면 n)
# ? What's your project's name? university-attendance-system (또는 원하는 이름)
# ? In which directory is your code located? ./ (Enter 키)
```

#### Step 2: 생성된 ID 확인

```bash
# .vercel/project.json 파일 확인
cat .vercel/project.json

# 출력 예시:
# {
#   "projectId": "prj_xxxxxxxxxxxxxxxxxxxxx",
#   "orgId": "team_xxxxxxxxxxxxxxxxxxxxx"
# }
```

#### Step 3: Vercel 토큰 생성

1. https://vercel.com/account/tokens 접속
2. "Create" 버튼 클릭
3. 토큰 이름 입력 (예: `github-actions`)
4. Scope: "Full Access" 선택
5. "Create" 클릭
6. 생성된 토큰 복사 (한 번만 표시됨!)

#### Step 4: GitHub Secrets 설정

1. GitHub 저장소 페이지 열기
2. Settings → Secrets and variables → Actions
3. "New repository secret" 클릭하여 각각 추가:

| Name | Value |
|------|-------|
| `VERCEL_TOKEN` | Vercel에서 생성한 토큰 |
| `VERCEL_PROJECT_ID` | project.json의 projectId 값 |
| `VERCEL_ORG_ID` | project.json의 orgId 값 |

### 방법 3: 새 Vercel 프로젝트 생성

Vercel 대시보드에서 직접 프로젝트를 생성하는 경우:

1. https://vercel.com/new 접속
2. GitHub 저장소 Import
3. 환경 변수 설정:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   ```
4. Deploy 클릭
5. 프로젝트 Settings → General에서 Project ID와 Team ID 확인
6. GitHub Secrets 설정 (위 Step 4 참조)

## 개선된 GitHub Actions Workflow

workflow 파일이 다음과 같이 개선되었습니다:
- ✅ Secrets 검증 단계 추가
- ✅ project.json 자동 생성
- ✅ 더 나은 오류 메시지
- ✅ 각 단계별 로그 추가

## 테스트 방법

1. **로컬 테스트**:
   ```bash
   vercel --token $VERCEL_TOKEN
   ```

2. **GitHub Actions 테스트**:
   - main 브랜치에 push
   - Actions 탭에서 배포 상태 확인
   - 오류 발생 시 로그 확인

## 일반적인 문제 해결

### 문제: "Project not found" 오류
- **해결**: GitHub Secrets의 PROJECT_ID와 ORG_ID가 올바른지 확인
- Vercel 대시보드의 프로젝트 Settings에서 확인 가능

### 문제: "Invalid token" 오류
- **해결**: 새 토큰 생성 후 GitHub Secret 업데이트

### 문제: "Scope not found" 오류
- **해결**:
  - 개인 계정: `VERCEL_ORG_ID`를 개인 계정 ID로 설정
  - 팀 계정: 팀 ID로 설정

### 문제: Build 실패
- **해결**: 환경 변수가 Vercel 프로젝트에 설정되었는지 확인

## 환경 변수 동기화

Vercel 프로젝트 환경 변수 설정:
```bash
# Vercel CLI로 환경 변수 추가
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

## 체크리스트

배포 전 확인사항:
- [ ] Vercel CLI로 프로젝트 연결됨 (`vercel link`)
- [ ] `.vercel/project.json` 파일 생성됨
- [ ] GitHub Secrets 설정됨 (TOKEN, PROJECT_ID, ORG_ID)
- [ ] Vercel 프로젝트에 환경 변수 설정됨
- [ ] `.gitignore`에 `.vercel` 추가됨

## 추가 리소스

- [Vercel CLI 문서](https://vercel.com/docs/cli)
- [GitHub Actions for Vercel](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)
- [Vercel 환경 변수](https://vercel.com/docs/environment-variables)