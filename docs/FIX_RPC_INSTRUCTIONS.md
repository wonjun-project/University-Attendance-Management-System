# 📚 RPC 함수 및 스키마 수정 가이드

## 🔧 문제 해결됨

### 수정된 이슈들:
1. ✅ "강의를 찾을 수 없습니다" 오류
2. ✅ `get_buildings` RPC 함수 누락
3. ✅ `get_rooms_by_building` RPC 함수 누락
4. ✅ courses 테이블 스키마 불일치

## 🚀 Supabase 마이그레이션 실행 방법

### 방법 1: Supabase 대시보드 사용 (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com 로그인
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭

3. **마이그레이션 실행**
   - `/database/migrations/011_fix_rpc_and_schema.sql` 파일 내용 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI가 설치되어 있지 않다면:
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref flmkocjijnzlxbzcmskh

# 마이그레이션 실행
supabase db push
```

## 📋 마이그레이션 내용

### 1. Courses 테이블 수정
- `classroom_location` JSONB 컬럼 추가
- `schedule` JSONB 컬럼 추가

### 2. Predefined Locations 테이블 생성
- 캠퍼스 건물 및 강의실 정보 저장
- 위치 기반 선택 지원

### 3. RPC 함수 생성
- `get_buildings()` - 건물 목록 조회
- `get_rooms_by_building(building_name)` - 건물별 강의실 조회

### 4. 샘플 데이터 추가
- 제1자연관, 제2자연관, 공학관 등 기본 위치 데이터

## ✅ 검증 방법

### 1. RPC 함수 테스트

Supabase SQL Editor에서 실행:

```sql
-- 건물 목록 조회
SELECT * FROM get_buildings();

-- 특정 건물의 강의실 조회
SELECT * FROM get_rooms_by_building('제1자연관');
```

### 2. 웹사이트에서 테스트

1. **교수 계정으로 로그인**
2. **강의 시작 클릭**
3. **위치 설정**:
   - "미리 정의된 위치" 선택
   - 건물 선택 (제1자연관 등)
   - 강의실 선택 (501호 등)
4. **QR 코드 생성** 버튼 클릭

## 🎯 예상 결과

- ✅ QR 코드가 정상적으로 생성됨
- ✅ "강의를 찾을 수 없습니다" 오류가 발생하지 않음
- ✅ 건물 및 강의실 목록이 정상적으로 표시됨

## 🐛 추가 디버깅 필요 시

만약 여전히 문제가 발생한다면:

1. **브라우저 개발자 도구** (F12) 열기
2. **Console 탭**에서 오류 메시지 확인
3. **Network 탭**에서 API 요청/응답 확인

## 📞 지원

문제가 지속되면 다음 정보와 함께 보고:
- 브라우저 콘솔 오류 메시지
- 네트워크 탭의 실패한 요청 정보
- 수행한 작업 순서