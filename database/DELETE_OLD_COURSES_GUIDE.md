# 오래된 강의 삭제 가이드

## 개요
김교수님 계정의 강의 중 최근 5개만 남기고 나머지를 삭제합니다.

## ⚠️ 주의사항
- **이 작업은 되돌릴 수 없습니다!**
- 삭제되는 강의와 함께 관련된 모든 데이터가 삭제됩니다:
  - 수업 세션 (class_sessions)
  - 출석 기록 (attendances)
  - 위치 로그 (location_logs)
  - 수강 등록 (course_enrollments)

## 실행 순서

### 1단계: 백업 실행 (필수!)
Supabase Dashboard의 SQL Editor에서 다음 파일을 실행하세요:
```
database/backup_courses_before_delete.sql
```
- 실행 결과를 파일로 저장해두세요
- 백업 데이터 개수를 확인하세요

### 2단계: 삭제할 강의 확인
`database/migrations/delete_old_courses.sql` 파일의 **1단계 쿼리만** 실행하세요:
```sql
SELECT
  c.id,
  c.name,
  c.course_code,
  c.created_at,
  COUNT(DISTINCT cs.id) as session_count,
  COUNT(DISTINCT a.id) as attendance_count
FROM courses c
LEFT JOIN class_sessions cs ON c.id = cs.course_id
LEFT JOIN attendances a ON cs.id = a.session_id
WHERE c.professor_id = (
  SELECT id FROM user_profiles
  WHERE name = '김교수' AND role = 'professor'
  LIMIT 1
)
AND c.id NOT IN (
  SELECT id FROM courses
  WHERE professor_id = (
    SELECT id FROM user_profiles
    WHERE name = '김교수' AND role = 'professor'
    LIMIT 1
  )
  ORDER BY created_at DESC
  LIMIT 5
)
GROUP BY c.id, c.name, c.course_code, c.created_at
ORDER BY c.created_at DESC;
```
- 삭제될 강의 목록을 확인하세요
- 예상과 다르면 작업을 중단하세요

### 3단계: 실제 삭제 실행
확인이 끝나면 `delete_old_courses.sql` 파일의 **2단계 DELETE 쿼리**를 실행하세요:
```sql
DELETE FROM courses
WHERE id IN (
  SELECT c.id FROM courses c
  WHERE c.professor_id = (
    SELECT id FROM user_profiles
    WHERE name = '김교수' AND role = 'professor'
    LIMIT 1
  )
  AND c.id NOT IN (
    SELECT id FROM courses
    WHERE professor_id = (
      SELECT id FROM user_profiles
      WHERE name = '김교수' AND role = 'professor'
      LIMIT 1
    )
    ORDER BY created_at DESC
    LIMIT 5
  )
);
```

### 4단계: 결과 확인
`delete_old_courses.sql` 파일의 **3단계 쿼리**를 실행하여 남은 강의를 확인하세요.

## 예상 결과
- **삭제 전**: 51개 강의, 237개 수업
- **삭제 후**: 5개 강의 (최근 생성된 강의만 남음)

## Supabase 접속 방법
1. Supabase Dashboard 접속: https://app.supabase.com
2. 프로젝트 선택
3. 왼쪽 메뉴에서 "SQL Editor" 클릭
4. "New query" 버튼 클릭
5. 위 SQL 스크립트를 복사하여 붙여넣기
6. "Run" 버튼 클릭

## 문제 발생 시
- 백업 파일을 확인하여 필요한 데이터를 복구하세요
- 개발자에게 문의하세요

## 참고
- `created_at` 기준으로 최신 5개 강의를 보존합니다
- CASCADE 설정으로 인해 관련 데이터가 자동 삭제됩니다
- RLS 정책에 따라 교수 본인의 강의만 삭제됩니다
