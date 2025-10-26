# API 문서

## 목차
- [인증 API](#인증-api)
- [출석 API](#출석-api)
- [세션 API](#세션-api)
- [QR 코드 API](#qr-코드-api)
- [강의 API](#강의-api)
- [에러 코드](#에러-코드)
- [표준 응답 형식](#표준-응답-형식)

---

## 인증 API

### POST `/api/auth/login`
사용자 로그인

**Rate Limit:** 5 requests/minute
**Performance Target:** < 500ms

**Request Body:**
```json
{
  "id": "202312345",           // 학번 또는 교수번호
  "password": "password123",   // 비밀번호
  "userType": "student"        // "student" | "professor"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "홍길동",
    "type": "student"
  }
}
```

**Error Responses:**
- `401 INVALID_CREDENTIALS` - 잘못된 인증 정보
- `400 VALIDATION_ERROR` - 요청 데이터 검증 실패
- `429 RATE_LIMIT_EXCEEDED` - Rate limit 초과

**Notes:**
- 성공 시 `auth-token` 쿠키 설정 (HttpOnly, 7일)
- bcrypt 해시 검증 사용

---

### POST `/api/auth/signup`
신규 사용자 회원가입

**Rate Limit:** 5 requests/minute
**Performance Target:** < 1000ms

**Request Body:**
```json
{
  "name": "홍길동",
  "password": "password123",
  "userType": "student",
  "studentId": "202312345",    // 학생인 경우 필수
  "professorId": "P12345"      // 교수인 경우 필수
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "홍길동",
    "type": "student"
  },
  "message": "회원가입이 완료되었습니다"
}
```

**Error Responses:**
- `400 BAD_REQUEST` - 필수 필드 누락
- `409 DUPLICATE_RESOURCE` - 이미 등록된 학번/교수번호
- `400 VALIDATION_ERROR` - 비밀번호 6자 미만 등

---

### POST `/api/auth/logout`
로그아웃

**Success Response (200):**
```json
{
  "success": true,
  "message": "로그아웃되었습니다"
}
```

**Notes:**
- `auth-token` 쿠키 삭제

---

### GET `/api/auth/session`
현재 세션 정보 조회

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "홍길동",
    "type": "student"
  }
}
```

**Error Response:**
- `401 UNAUTHORIZED` - 인증되지 않음

---

## 출석 API

### POST `/api/attendance/checkin`
출석 체크인 (QR 스캔 후 위치 검증)

**Rate Limit:** 10 requests/minute
**Performance Target:** < 1000ms
**Authentication:** Required (Student only)

**Request Body:**
```json
{
  "sessionId": "uuid",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "accuracy": 10.5,                    // GPS 정확도 (미터)
  "clientTimestamp": "2025-01-26T10:30:00.000Z",
  "correlationId": "uuid",             // 선택
  "attemptNumber": 0                   // 선택
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "attendanceId": "uuid",
    "status": "present",
    "checkedInAt": "2025-01-26T10:30:15.123Z",
    "location": {
      "distance": 8.5,                 // 강의실로부터 거리 (미터)
      "allowed": true
    }
  }
}
```

**Error Responses:**
- `401 UNAUTHORIZED` - 인증 필요
- `403 FORBIDDEN` - 학생만 체크인 가능
- `400 LOCATION_OUT_OF_RANGE` - 강의실 범위 밖
- `409 ATTENDANCE_ALREADY_RECORDED` - 이미 출석 완료
- `410 SESSION_EXPIRED` - 세션 종료됨
- `400 BAD_REQUEST` - clock skew (60초 초과)

**Notes:**
- GPS 정확도가 낮으면 경고 로그
- 위치 이탈 연속 2회 시 자동 조퇴 처리
- 세션 시작 전/후 체크인 불가

---

### POST `/api/attendance/heartbeat`
실시간 위치 추적 (출석 체크인 후 주기적 호출)

**Rate Limit:** 제한 없음
**Authentication:** Required (Student only)

**Request Body:**
```json
{
  "sessionId": "uuid",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "accuracy": 10.5,
  "timestamp": "2025-01-26T10:35:00.000Z"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "distance": 8.5,
    "withinRange": true,
    "statusChanged": false,
    "newStatus": null
  }
}
```

**Status Changed Response (200):**
```json
{
  "success": true,
  "data": {
    "distance": 150.5,
    "withinRange": false,
    "statusChanged": true,
    "newStatus": "left_early",
    "message": "위치 이탈이 감지되어 조퇴 처리되었습니다"
  }
}
```

**Notes:**
- 30초마다 호출 권장
- 연속 2회 위치 이탈 시 자동 조퇴

---

### GET `/api/attendance/status`
학생의 특정 세션 출석 상태 조회

**Authentication:** Required (Student only)

**Query Parameters:**
- `sessionId` (required): 세션 ID

**Success Response (200):**
```json
{
  "attendance": {
    "id": "uuid",
    "status": "present",
    "checked_in_at": "2025-01-26T10:30:15.123Z"
  },
  "session": {
    "id": "uuid",
    "start_time": "2025-01-26T10:00:00Z",
    "end_time": "2025-01-26T12:00:00Z"
  }
}
```

**No Attendance Response (200):**
```json
{
  "attendance": null,
  "session": { /* ... */ }
}
```

---

### GET `/api/attendance/student/records`
학생의 출석 기록 조회

**Authentication:** Required (Student only)

**Query Parameters:**
- `courseId` (optional): 특정 강의 필터

**Success Response (200):**
```json
{
  "records": [
    {
      "id": "uuid",
      "course_name": "데이터베이스",
      "session_date": "2025-01-26",
      "status": "present",
      "checked_in_at": "2025-01-26T10:30:15.123Z"
    }
  ]
}
```

---

### GET `/api/attendance/professor/dashboard`
교수 대시보드 - 실시간 출석 현황

**Authentication:** Required (Professor only)

**Query Parameters:**
- `sessionId` (required): 세션 ID

**Success Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "course_name": "데이터베이스",
    "start_time": "2025-01-26T10:00:00Z",
    "end_time": "2025-01-26T12:00:00Z"
  },
  "statistics": {
    "total_enrolled": 30,
    "present": 25,
    "absent": 3,
    "late": 1,
    "left_early": 1,
    "attendance_rate": 83.3
  },
  "students": [
    {
      "student_id": "202312345",
      "name": "홍길동",
      "status": "present",
      "checked_in_at": "2025-01-26T10:30:15.123Z",
      "last_location_update": "2025-01-26T10:35:00.123Z"
    }
  ]
}
```

---

## 세션 API

### POST `/api/sessions/create`
새로운 출석 세션 생성

**Authentication:** Required (Professor only)

**Request Body:**
```json
{
  "courseId": "uuid",
  "startTime": "2025-01-26T10:00:00Z",
  "endTime": "2025-01-26T12:00:00Z",
  "classroomLatitude": 37.5665,        // 선택
  "classroomLongitude": 126.9780,      // 선택
  "classroomRadius": 100               // 선택 (미터)
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "courseId": "uuid",
    "startTime": "2025-01-26T10:00:00Z",
    "endTime": "2025-01-26T12:00:00Z"
  }
}
```

**Notes:**
- 위치 정보 미제공 시 강의(course)의 기본 위치 사용

---

### GET `/api/sessions/[id]`
세션 정보 조회

**Authentication:** Required

**Success Response (200):**
```json
{
  "id": "uuid",
  "course_id": "uuid",
  "start_time": "2025-01-26T10:00:00Z",
  "end_time": "2025-01-26T12:00:00Z",
  "is_active": true,
  "classroom_latitude": 37.5665,
  "classroom_longitude": 126.9780,
  "classroom_radius": 100
}
```

---

### POST `/api/sessions/[id]/end`
세션 종료

**Authentication:** Required (Professor only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "세션이 종료되었습니다",
  "data": {
    "sessionId": "uuid",
    "endedAt": "2025-01-26T12:00:00.123Z"
  }
}
```

---

## QR 코드 API

### POST `/api/qr/generate`
QR 코드 생성

**Rate Limit:** 20 requests/hour
**Authentication:** Required (Professor only)

**Request Body:**
```json
{
  "sessionId": "uuid"
}
```

**Success Response (200):**
```json
{
  "qrCode": "data:image/png;base64,...",
  "token": "uuid",
  "expiresAt": "2025-01-26T10:05:00.000Z"
}
```

**Notes:**
- QR 코드는 5분 후 만료
- QR 데이터: `{"sessionId":"uuid","token":"uuid","timestamp":"..."}`

---

## 강의 API

### GET `/api/courses`
사용자의 강의 목록 조회

**Authentication:** Required

**Success Response (200) - Professor:**
```json
{
  "courses": [
    {
      "id": "uuid",
      "name": "데이터베이스",
      "code": "CS301",
      "location": "공학관 301호",
      "location_latitude": 37.5665,
      "location_longitude": 126.9780,
      "location_radius": 100
    }
  ]
}
```

**Success Response (200) - Student:**
```json
{
  "courses": [
    {
      "id": "uuid",
      "name": "데이터베이스",
      "code": "CS301",
      "professor_name": "김교수"
    }
  ]
}
```

---

### GET `/api/courses/[courseId]`
특정 강의 상세 정보

**Authentication:** Required

**Success Response (200):**
```json
{
  "id": "uuid",
  "name": "데이터베이스",
  "code": "CS301",
  "location": "공학관 301호",
  "location_latitude": 37.5665,
  "location_longitude": 126.9780,
  "location_radius": 100,
  "professor_id": "uuid",
  "professor_name": "김교수"
}
```

---

## 기타 API

### GET `/api/csrf`
CSRF 토큰 발급

**Success Response (200):**
```json
{
  "success": true,
  "message": "CSRF token generated"
}
```

**Notes:**
- 응답 쿠키에 `csrf-token` 설정
- 응답 헤더에 `x-csrf-token` 포함

---

## 에러 코드

### 인증/인가 에러 (400번대)
| 코드 | HTTP | 설명 |
|-----|------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `INVALID_CREDENTIALS` | 401 | 잘못된 인증 정보 |
| `TOKEN_EXPIRED` | 401 | 토큰 만료 |
| `INVALID_TOKEN` | 401 | 유효하지 않은 토큰 |

### 요청 에러 (400번대)
| 코드 | HTTP | 설명 |
|-----|------|------|
| `BAD_REQUEST` | 400 | 잘못된 요청 |
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 |
| `MISSING_REQUIRED_FIELD` | 400 | 필수 필드 누락 |
| `INVALID_INPUT` | 400 | 유효하지 않은 입력 |
| `RESOURCE_NOT_FOUND` | 404 | 리소스 없음 |
| `DUPLICATE_RESOURCE` | 409 | 중복 리소스 |

### 비즈니스 로직 에러
| 코드 | HTTP | 설명 |
|-----|------|------|
| `ATTENDANCE_ALREADY_RECORDED` | 409 | 이미 출석 완료 |
| `LOCATION_OUT_OF_RANGE` | 400 | 강의실 범위 밖 |
| `SESSION_EXPIRED` | 410 | 세션 종료됨 |
| `SESSION_NOT_STARTED` | 400 | 세션 시작 전 |
| `QR_CODE_EXPIRED` | 410 | QR 코드 만료 |
| `QR_CODE_INVALID` | 400 | 유효하지 않은 QR |

### 보안 에러
| 코드 | HTTP | 설명 |
|-----|------|------|
| `CSRF_TOKEN_MISSING` | 403 | CSRF 토큰 누락 |
| `CSRF_TOKEN_INVALID` | 403 | CSRF 토큰 불일치 |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit 초과 |

### 서버 에러 (500번대)
| 코드 | HTTP | 설명 |
|-----|------|------|
| `INTERNAL_SERVER_ERROR` | 500 | 서버 내부 오류 |
| `DATABASE_ERROR` | 500 | 데이터베이스 오류 |
| `EXTERNAL_SERVICE_ERROR` | 502 | 외부 서비스 오류 |

---

## 표준 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { /* 응답 데이터 */ },
  "message": "optional success message",
  "meta": {
    "timestamp": "2025-01-26T10:30:00.000Z",
    "requestId": "uuid"
  }
}
```

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 유효하지 않습니다",
    "details": [
      {
        "field": "email",
        "message": "유효한 이메일을 입력하세요"
      }
    ],
    "field": "email"
  },
  "meta": {
    "timestamp": "2025-01-26T10:30:00.000Z",
    "requestId": "uuid"
  }
}
```

### 페이지네이션 응답
```json
{
  "success": true,
  "data": [ /* 배열 데이터 */ ],
  "meta": {
    "timestamp": "2025-01-26T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## Rate Limiting

API 엔드포인트별 Rate Limit:

| 엔드포인트 | Limit |
|----------|-------|
| `/api/auth/login` | 5 req/min |
| `/api/auth/signup` | 5 req/min |
| `/api/attendance/checkin` | 10 req/min |
| `/api/qr/generate` | 20 req/hour |

Rate limit 초과 시:
- HTTP 429 응답
- `Retry-After` 헤더에 재시도 가능 시간 포함

---

## 보안 헤더

모든 응답에 다음 헤더 포함:

- `X-Response-Time`: API 응답 시간 (ms)
- `X-Request-ID`: 요청 추적 ID
- `Strict-Transport-Security`: HTTPS 강제
- `X-Frame-Options: SAMEORIGIN`: Clickjacking 방지
- `X-Content-Type-Options: nosniff`: MIME sniffing 방지
- `Content-Security-Policy`: XSS 방지

---

## 클라이언트 구현 예제

### Fetch with Authentication
```typescript
const response = await fetch('/api/attendance/checkin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // 쿠키 포함
  body: JSON.stringify({
    sessionId: 'uuid',
    latitude: 37.5665,
    longitude: 126.9780,
    accuracy: 10.5,
    clientTimestamp: new Date().toISOString(),
  }),
})

if (!response.ok) {
  const error = await response.json()
  console.error(error.error.code, error.error.message)
}

const result = await response.json()
```

### Fetch with CSRF Protection
```typescript
import { withCSRFHeaders } from '@/lib/middleware/csrf'

const response = await fetch('/api/sessions/create',
  withCSRFHeaders({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ /* ... */ }),
  })
)
```

### Using React Hook
```typescript
import { useCSRF } from '@/hooks/use-csrf'

function MyComponent() {
  const { fetchWithCSRF } = useCSRF()

  const handleSubmit = async () => {
    const response = await fetchWithCSRF('/api/sessions/create', {
      method: 'POST',
      body: JSON.stringify({ /* ... */ }),
    })
  }
}
```
