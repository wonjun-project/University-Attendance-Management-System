# 대학 출석 관리 시스템 MVP

QR코드와 GPS를 이용해서 대학 출석을 관리하는 웹 애플리케이션입니다.

## 🌟 주요 기능

### 👨‍🎓 학생 기능
- **학번으로 로그인**: 간단한 학번 입력으로 로그인
- **QR코드 스캔**: 카메라로 교수님 QR코드 스캔하여 출석
- **위치 확인**: 강의실 근처에서만 출석 가능
- **출석 현황**: 내 출석 상태와 기록 확인

### 👨‍🏫 교수 기능
- **교수 로그인**: 교수 계정으로 시스템 접근
- **QR코드 만들기**: 수업용 출석 QR코드 생성
- **출석 확인**: 학생들 출석 현황 실시간 확인
- **출석 통계**: 출석률과 결석 현황 파악

## 🛠 기술 스택

### Frontend
- **Next.js 14**: App Router, TypeScript
- **Tailwind CSS**: 반응형 UI/UX 디자인
- **PWA**: 모바일 친화적 Progressive Web App
- **Geolocation API**: 실시간 GPS 위치 추적

### Backend
- **Supabase**: PostgreSQL + Real-time + Auth
- **Next.js API Routes**: RESTful API 엔드포인트
- **Row Level Security**: 데이터 보안 및 권한 관리

### 외부 라이브러리
- **QRCode.js**: QR코드 생성
- **Html5-Qrcode**: 모바일 QR코드 스캔
- **Class Variance Authority**: 컴포넌트 variant 관리

## 🚀 배포 및 실행

### 개발 환경 설정

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd college-attendance-management
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **환경변수 설정**
   `.env.local` 파일 생성:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

4. **데이터베이스 설정**
   - Supabase 대시보드에서 새 프로젝트 생성
   - `database/migrations/` 폴더의 SQL 파일들을 순서대로 실행
   - Authentication 설정에서 Site URL 및 Redirect URLs 구성

5. **개발 서버 실행**
   ```bash
   npm run dev
   ```

   모바일 기기에서 카메라를 사용하려면 HTTPS가 필요합니다. 자체 서명 인증서로 HTTPS 개발 서버를 실행하려면 아래 명령을 사용하세요.

   ```bash
   npm run dev:https
   ```

   첫 실행 시 `certs/dev/localhost-cert.pem`을 브라우저(또는 기기)에 신뢰하도록 추가해야 카메라 권한이 정상 작동합니다.

### Vercel 배포

#### 자동 배포 (GitHub Actions)

1. **Vercel 프로젝트 연결**
   ```bash
   ./scripts/setup-vercel.sh
   # 또는 수동으로:
   vercel link
   ```

2. **GitHub Secrets 설정**
   - `VERCEL_TOKEN`: [Vercel 토큰 생성](https://vercel.com/account/tokens)
   - `VERCEL_PROJECT_ID`: `.vercel/project.json`에서 확인
   - `VERCEL_ORG_ID`: `.vercel/project.json`에서 확인

3. **환경변수 설정** (Vercel 대시보드 또는 CLI)
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

4. **자동 배포**
   - `main` 브랜치 push 시 자동 배포
   - GitHub Actions 탭에서 상태 확인

#### 수동 배포

```bash
npm i -g vercel
vercel --prod
```

> 📚 자세한 내용은 [Vercel 배포 가이드](./docs/VERCEL_DEPLOYMENT_FIX.md) 참조

## 📱 사용 방법

### 교수 워크플로우
1. 교수 계정으로 로그인
2. "QR코드 생성" 버튼 클릭
3. 생성된 QR코드를 강의실 화면에 표시
4. 실시간 출석 현황에서 학생들의 출석 상태 모니터링

### 학생 워크플로우
1. 학번으로 회원가입/로그인
2. "QR코드 스캔" 버튼 클릭
3. 카메라로 교수님의 QR코드 스캔
4. GPS 위치 권한 허용 후 출석 체크
5. 2시간 동안 강의실 위치 유지

## 🔒 보안 기능

- **Row Level Security**: 사용자별 데이터 접근 제한
- **GPS 정확도 검증**: 위치 스푸핑 방지
- **QR코드 만료**: 30분 자동 만료로 보안 강화
- **실시간 위치 추적**: 대리 출석 방지를 위한 지속적 모니터링

## 📊 핵심 알고리즘

### 위치 검증
```typescript
// Haversine 공식을 사용한 거리 계산
const distance = calculateDistance(
  studentLat, studentLon,
  classroomLat, classroomLon
)
return distance <= allowedRadius // 50m 기본값
```

### 출석 상태 관리
- **출석**: 시간 내 QR 스캔 + 위치 인증 성공
- **지각**: 수업 시작 후 15분 이내 체크인
- **조퇴**: 수업 중 강의실 반경 이탈
- **결석**: 출석 체크 없음 또는 위치 인증 실패

## 🎯 향후 개선사항

- [ ] 강의 일정 자동 생성
- [ ] 출석 데이터 CSV 내보내기
- [ ] 푸시 알림 시스템
- [ ] 다중 강의실 지원
- [ ] 출석 통계 시각화

## 📝 라이선스

이 프로젝트는 교육용 목적으로 개발된 MVP입니다.

---

**📚 2025년 웹개발 프로젝트**
