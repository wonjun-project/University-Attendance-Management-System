# PDR 시스템 테스트 가이드 (학생용)

> 💡 **이 문서는**: GPS-PDR 융합 출석 시스템이 제대로 작동하는지 확인하는 가이드입니다.
> ⏱️ **소요 시간**: 기본 테스트 10분, 정밀 테스트 30분

---

## 📱 준비물

- [ ] 스마트폰 (GPS 지원 기기)
- [ ] 충전된 배터리 (50% 이상 권장)
- [ ] Wi-Fi 또는 모바일 데이터
- [ ] (선택) 줄자 또는 알려진 거리 (예: 복도 20m)

---

## 🚀 1단계: 시스템 시작하기 (2분)

### 1-1. 서버 실행

**컴퓨터에서**:

```bash
# 프로젝트 폴더로 이동
cd University-Attendance-Management-System

# 개발 서버 실행
npm run dev
```

**성공하면 이렇게 나옵니다**:
```
✓ Ready in 2.3s
○ Local:   http://localhost:3001
```

### 1-2. 스마트폰에서 접속

**방법 A: 같은 Wi-Fi 사용 시** (권장)

1. 컴퓨터의 IP 주소 확인:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

   예시 결과: `192.168.0.10`

2. 스마트폰에서 브라우저 열기
3. 주소창에 입력: `http://192.168.0.10:3001`

**방법 B: USB 테더링/핫스팟**

1. 스마트폰 핫스팟 켜기
2. 컴퓨터를 핫스팟에 연결
3. 1번 방법과 동일하게 IP 확인 후 접속

### 1-3. 권한 허용

스마트폰에서 다음 권한 허용:
- [ ] **위치 정보** (GPS) - 필수
- [ ] **모션 센서** (걸음 감지) - 자동 허용 (iOS는 별도 팝업 없음)

---

## ✅ 2단계: 기본 동작 테스트 (5분)

### 2-1. 로그인

1. 학생 계정으로 로그인:
   ```
   학번: 2021001
   비밀번호: password123
   ```

2. 메인 페이지에서 활성 수업 확인

### 2-2. QR 코드 스캔

**준비**: 교수 계정으로 QR 코드 생성 필요
- 교수 계정: `professor1` / `password123`
- "수업 시작" 버튼 클릭 → QR 생성

**학생 앱에서**:

1. "QR 스캔" 버튼 클릭
2. QR 코드 카메라로 스캔
3. **GPS 위치 획득 대기** (3~10초)
   - 진행 바가 표시됨
   - "위치 확인 중..." 메시지 확인

4. **성공 메시지 확인**:
   ```
   ✅ 출석 체크 완료!
   ```

### 2-3. 브라우저 콘솔 확인 (중요!)

**스마트폰 브라우저 콘솔 열기**:

- **iPhone (Safari)**:
  1. 설정 > Safari > 고급 > 웹 인스펙터 켜기
  2. 컴퓨터에서 Safari > 개발 > [내 iPhone] > 페이지 선택

- **Android (Chrome)**:
  1. 스마트폰 Chrome에서 `chrome://inspect` 입력
  2. 또는 컴퓨터 Chrome에서 `chrome://inspect` > 기기 선택

**확인할 로그**:

```javascript
// 1. QR 스캔 직후
🌍 [Environment Detector] 감지된 환경: outdoor
// 또는
🌍 [Environment Detector] 감지된 환경: indoor

// 2. 체크인 후 30초 대기 (Heartbeat 시작)
🔄 GPS+PDR Fusion Manager 초기화 중...
✅ GPS+PDR Fusion 초기화 완료: { initialPosition: {...}, accuracy: 12.5 }

// 3. 30초마다 반복
💓 Heartbeat [foreground]: 홍길동 (37.123456, 127.123456) [fusion, outdoor, conf: 0.85]
✅ Heartbeat 성공 [FG]: { distance: 5, locationValid: true, trackingMode: 'fusion', environment: 'outdoor', confidence: 0.85 }
```

**체크리스트**:
- [ ] `🌍 [Environment Detector]` 메시지 확인
- [ ] `outdoor` 또는 `indoor` 표시 확인
- [ ] `✅ GPS+PDR Fusion 초기화 완료` 확인
- [ ] 30초 후 `💓 Heartbeat` 메시지 확인
- [ ] `trackingMode: 'fusion'` 또는 `'gps-only'` 확인

---

## 🚶 3단계: 걷기 테스트 (5분)

### 3-1. 제자리 테스트 (1분)

**목적**: 가만히 있을 때 잘못된 걸음이 감지되지 않는지 확인

1. 스마트폰을 들고 제자리에 서기
2. 1분 동안 움직이지 않기
3. 콘솔 확인 → Heartbeat 2회 발생

**예상 결과**:
```javascript
💓 Heartbeat [foreground]: ... [fusion, outdoor, conf: 0.85]
💓 Heartbeat [foreground]: ... [fusion, outdoor, conf: 0.83]
// 위치가 거의 변하지 않아야 함 (±2m 이내)
```

**통과 조건**:
- [ ] 위도/경도가 거의 변하지 않음 (소수점 4자리까지 유사)
- [ ] 거짓 걸음으로 인한 큰 위치 변화 없음

### 3-2. 걷기 테스트 (2분)

**목적**: 실제로 걸을 때 위치가 업데이트되는지 확인

1. 스마트폰을 들고 일정한 속도로 걷기
2. 10~20걸음 정도 걷기 (약 10~15m)
3. 30초 정지 → Heartbeat 발생 대기
4. 콘솔 확인

**예상 결과**:
```javascript
// 걷기 전
💓 Heartbeat: (37.123456, 127.123456) [fusion, outdoor, conf: 0.85]

// 걷기 후 (위치 변경됨)
💓 Heartbeat: (37.123567, 127.123789) [fusion, outdoor, conf: 0.80]
// 거리가 증가했어야 함
```

**통과 조건**:
- [ ] 위도/경도가 변경됨
- [ ] `trackingMode`가 'fusion' 또는 'pdr-only'로 표시
- [ ] `confidence`가 0.5 이상

---

## 🏢 4단계: 실내/실외 전환 테스트 (10분)

### 4-1. 실외에서 시작

**장소**: 건물 밖 (운동장, 주차장 등)

1. QR 체크인 (아직 안 했으면)
2. 30초 대기 → Heartbeat 1회
3. 콘솔 확인:
   ```javascript
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.85]
   또는
   💓 Heartbeat: ... [gps-only, outdoor, conf: 0.90]
   ```

**확인**:
- [ ] `environment: 'outdoor'` 표시
- [ ] `accuracy`가 낮음 (5~20m)

### 4-2. 건물 안으로 이동

**장소**: 건물 1~2층 내부

1. 건물 안으로 걸어 들어가기
2. 1~2분 대기 (Heartbeat 2~3회 발생까지)
3. 콘솔 확인:
   ```javascript
   // 처음엔 outdoor일 수 있음
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.70]

   // 1~2분 후 indoor로 전환
   💓 Heartbeat: ... [fusion, indoor, conf: 0.65]
   또는
   💓 Heartbeat: ... [pdr-only, indoor, conf: 0.60]
   ```

**확인**:
- [ ] `environment: 'indoor'`로 변경
- [ ] `trackingMode`가 'pdr-only' 또는 'fusion'
- [ ] `accuracy`가 증가 (30~100m)

### 4-3. 다시 실외로

**장소**: 건물 밖으로 나가기

1. 건물 밖으로 걸어 나가기
2. 1~2분 대기
3. 콘솔 확인:
   ```javascript
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.82]
   ```

**확인**:
- [ ] `environment`가 다시 'outdoor'로 변경
- [ ] `accuracy`가 감소 (10~25m)

---

## 📊 5단계: 데이터베이스 확인 (5분)

### 5-1. Supabase 접속

1. 브라우저에서 [Supabase Dashboard](https://supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴: **SQL Editor** 클릭

### 5-2. 데이터 조회

**복사-붙여넣기**:

```sql
-- 내 최근 위치 로그 20개 확인
SELECT
  created_at AS 시간,
  tracking_mode AS 추적모드,
  environment AS 환경,
  confidence AS 신뢰도,
  gps_weight AS GPS가중치,
  pdr_weight AS PDR가중치,
  accuracy AS GPS정확도,
  is_valid AS 범위내
FROM location_logs
WHERE attendance_id IN (
  SELECT id FROM attendances
  WHERE student_id = '2021001'  -- 내 학번으로 변경
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY created_at DESC
LIMIT 20;
```

**실행**: "Run" 버튼 클릭 (또는 Ctrl+Enter)

### 5-3. 결과 확인

**예상 결과 (표 형식)**:

| 시간 | 추적모드 | 환경 | 신뢰도 | GPS가중치 | PDR가중치 | GPS정확도 | 범위내 |
|------|---------|------|--------|----------|----------|----------|--------|
| 14:05:30 | fusion | outdoor | 0.85 | 0.75 | 0.25 | 12.5 | true |
| 14:05:00 | fusion | outdoor | 0.82 | 0.70 | 0.30 | 15.3 | true |
| 14:04:30 | pdr-only | indoor | 0.65 | 0.00 | 1.00 | 8.2 | true |
| 14:04:00 | fusion | indoor | 0.68 | 0.45 | 0.55 | 65.0 | true |

**체크리스트**:
- [ ] `추적모드`가 null이 아님 (값이 있음)
- [ ] `환경`이 실제 위치와 일치 (outdoor/indoor)
- [ ] `신뢰도`가 0.5 ~ 1.0 사이
- [ ] `GPS가중치 + PDR가중치 ≈ 1.0`
- [ ] 데이터가 30초마다 1개씩 생성됨

---

## 🎯 6단계: 거리 정확도 테스트 (선택, 15분)

### 준비물
- 줄자 또는 알려진 거리
- 예시: 복도 끝에서 끝 (20m), 운동장 트랙 (100m)

### 6-1. 시작점 기록

1. 알려진 거리의 시작점에 서기
2. QR 체크인 (또는 이미 완료)
3. 30초 대기 → Heartbeat 1회
4. **시작 좌표 기록**:
   ```javascript
   // 콘솔에서 복사
   💓 Heartbeat: ... (37.123456, 127.123456) ...
   ```
   - 위도: `37.123456`
   - 경도: `127.123456`

### 6-2. 걷기

1. 일정한 속도로 목표 거리까지 걷기 (예: 20m)
2. 끝점에 도착하면 30초 정지
3. Heartbeat 1회 대기
4. **끝 좌표 기록**:
   ```javascript
   💓 Heartbeat: ... (37.123567, 127.123789) ...
   ```
   - 위도: `37.123567`
   - 경도: `127.123789`

### 6-3. 거리 계산

**온라인 계산기 사용**:

1. [GPS 거리 계산기](https://www.nhc.noaa.gov/gccalc.shtml) 접속
2. 시작점 좌표 입력
3. 끝점 좌표 입력
4. "Compute" 클릭
5. 결과 확인 (미터 단위)

**또는 Python 사용**:

```python
from math import radians, sin, cos, sqrt, atan2

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # 지구 반지름 (미터)
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# 좌표 입력 (예시)
start_lat = 37.123456
start_lon = 127.123456
end_lat = 37.123567
end_lon = 127.123789

distance = calculate_distance(start_lat, start_lon, end_lat, end_lon)
print(f"PDR 추정 거리: {distance:.1f}m")

# 실제 거리와 비교
actual_distance = 20.0
error_percent = abs(distance - actual_distance) / actual_distance * 100
print(f"실제 거리: {actual_distance}m")
print(f"오차율: {error_percent:.1f}%")
```

### 6-4. 결과 평가

**오차율 계산**:
```
오차율 = |추정 거리 - 실제 거리| / 실제 거리 × 100%
```

**예시**:
- 실제: 20.0m
- 추정: 21.8m
- 오차율: `|21.8 - 20.0| / 20.0 × 100% = 9%`

**평가 기준**:
- ✅ **우수**: 오차율 < 10% (18~22m)
- ⚠️ **양호**: 오차율 10~15% (17~23m)
- ❌ **조정 필요**: 오차율 > 15% (< 17m 또는 > 23m)

---

## 🔧 7단계: 문제 해결 (필요 시)

### 문제 1: "GPS+PDR Fusion 초기화" 메시지가 안 나옴

**원인**: Fusion이 비활성화되었거나 에러 발생

**해결**:
1. 콘솔에서 에러 메시지 확인
2. GPS 권한 다시 확인
3. 페이지 새로고침 후 재시도

### 문제 2: `environment`가 항상 'unknown'

**원인**: GPS 정확도를 판단할 수 없음

**해결**:
1. 실외로 나가서 GPS 신호 개선 대기 (1~2분)
2. 비행기 모드 껐다 켜기
3. 위치 서비스 재시작

### 문제 3: `trackingMode`가 항상 'gps-only'

**원인**: PDR이 작동하지 않거나 GPS 가중치가 너무 높음

**해결**:
1. 모션 센서 권한 확인 (설정 > Safari/Chrome > 모션 및 방향)
2. 실내로 이동 → GPS 정확도 낮아지면 자동 전환
3. 걷기 테스트 → PDR 활성화 확인

### 문제 4: 거리가 너무 크게/작게 추정됨

**오차율 > 20%인 경우**

**해결**:
```typescript
// lib/config/pdr-config.ts 파일 수정

// 거리가 과대 추정되면 (예: 20m → 28m)
export const WEINBERG_CONFIG = {
  K: 0.38,  // 기본 0.43에서 감소
  // ...
}

// 거리가 과소 추정되면 (예: 20m → 15m)
export const WEINBERG_CONFIG = {
  K: 0.48,  // 기본 0.43에서 증가
  // ...
}
```

**재시작**:
1. `Ctrl+C`로 서버 중지
2. `npm run dev`로 재시작
3. 페이지 새로고침
4. 재테스트

### 문제 5: Heartbeat가 30초마다 안 나옴

**원인**: 네트워크 문제 또는 API 에러

**해결**:
1. 콘솔에서 에러 메시지 확인:
   ```javascript
   ❌ Heartbeat 실패 [시도 1/3]: ...
   ```
2. 네트워크 연결 확인
3. 서버 로그 확인 (터미널)
4. Supabase 연결 확인

---

## 📋 테스트 결과 기록 양식

테스트 완료 후 아래 양식을 작성해주세요.

```markdown
## PDR 시스템 테스트 결과

**테스트 일시**: 2025-10-30 14:00
**테스터 이름**: 홍길동
**기기**: iPhone 14 Pro / Galaxy S23
**장소**: 캠퍼스 A동 2층 + 운동장

### 1. 기본 동작 테스트
- [ ] QR 스캔 성공
- [ ] Environment 감지 성공 (outdoor/indoor)
- [ ] GPS+PDR Fusion 초기화 성공
- [ ] Heartbeat 30초마다 발생

### 2. 걷기 테스트
- [ ] 제자리: 위치 변화 없음 (통과)
- [ ] 걷기: 위치 변화 확인 (통과)
- [ ] tracking_mode 표시 (fusion/pdr-only/gps-only)

### 3. 환경 전환 테스트
- [ ] 실외: environment = 'outdoor'
- [ ] 실내: environment = 'indoor'
- [ ] 재전환: 다시 'outdoor'로 변경

### 4. 데이터베이스 확인
- [ ] PDR 메타데이터 저장 확인
- [ ] tracking_mode 값 있음
- [ ] environment 값 정확함
- [ ] confidence 0.5 ~ 1.0 범위

### 5. 거리 테스트 (선택)
- 실제 거리: 20.0m
- 추정 거리: 21.3m
- 오차율: 6.5% ✅

### 발견된 문제
- (없음 또는 문제 설명)

### 개선 제안
- (있으면 작성)
```

---

## 🎓 추가 학습 자료

### PDR이 뭔가요?

**PDR (Pedestrian Dead Reckoning)** = 보행자 위치 추측 항법

- GPS 신호가 약한 실내에서도 위치 추적 가능
- 스마트폰의 **가속도계**와 **자이로스코프** 센서 사용
- 걸음 수 + 걸음 방향 → 상대적 이동 거리 계산

**장점**:
- 실내에서도 작동
- GPS보다 빠른 업데이트 (센서는 초당 수십~수백 Hz)
- 배터리 효율적 (센서는 늘 켜져 있음)

**단점**:
- 시간이 지나면 오차 누적 (drift)
- 정기적으로 GPS로 보정 필요
- 센서 노이즈에 민감

### Fusion이 뭔가요?

**Fusion (융합)** = GPS + PDR을 합쳐서 최적의 위치 계산

- GPS 정확도가 좋으면 → GPS 가중치 높임 (0.7~0.9)
- GPS 정확도가 나쁘면 → PDR 가중치 높임 (0.5~0.7)
- **Complementary Filter** 알고리즘 사용

**예시**:
```
실외:
  GPS 정확도: 12m (좋음)
  → GPS weight: 0.8, PDR weight: 0.2
  → 주로 GPS 신뢰

실내:
  GPS 정확도: 85m (나쁨)
  → GPS weight: 0.5, PDR weight: 0.5
  → GPS와 PDR 균형적으로 사용
```

### Weinberg 공식이 뭔가요?

**Weinberg 공식** = 걸음 길이 추정 알고리즘

```
걸음 길이 = K × ⁴√(가속도 최대 - 가속도 최소)
```

- `K`: 사용자별 보정 계수 (보통 0.43)
- 키가 크면 K↑, 작으면 K↓
- 걸음이 크면 가속도 변화 큼 → 걸음 길이 큼

**예시**:
```
가속도 범위: 9.8 ~ 12.5 m/s²
K = 0.43
걸음 길이 = 0.43 × ⁴√(12.5 - 9.8)
         = 0.43 × ⁴√2.7
         = 0.43 × 1.28
         = 0.55m (55cm)
```

---

## ❓ FAQ (자주 묻는 질문)

### Q1. 테스트는 실내에서 해도 되나요?

**A**: 네, 가능합니다! 하지만 **실외 → 실내 → 실외** 전환 테스트가 중요하므로, 가능하면 건물 밖에서 시작하는 것을 권장합니다.

### Q2. 스마트폰을 주머니에 넣어도 되나요?

**A**:
- **QR 스캔 시**: 손에 들고 있어야 함 (카메라 사용)
- **Heartbeat 추적 시**: 주머니에 넣어도 OK
- **걷기 테스트 시**: 손에 들거나 가방에 넣으면 더 정확

### Q3. 배터리가 빨리 닳나요?

**A**: 30분 테스트 시 약 5~10% 소모됩니다. 충전 걱정 없이 테스트 가능합니다.

### Q4. 콘솔을 어떻게 여나요? (모바일)

**A**:
- **가장 쉬운 방법**: 컴퓨터 Chrome에서 `chrome://inspect` 접속 → 스마트폰 연결 → 원격 디버깅
- **iPhone**: Mac Safari 필요
- **Android**: USB 디버깅 모드 켜야 함

컴퓨터가 없으면 서버 로그로 대체 가능합니다.

### Q5. 오차율이 높으면 어떻게 하나요?

**A**:
1. 파라미터 조정 (위 "문제 해결" 참고)
2. 다양한 경로에서 재테스트
3. 평균 오차율로 평가
4. 10~15% 정도는 정상 범위입니다

### Q6. tracking_mode가 계속 바뀌어요

**A**: 정상입니다!
- GPS 정확도에 따라 자동으로 전환됩니다
- `gps-only` ↔ `fusion` ↔ `pdr-only` 전환은 자연스러운 동작

### Q7. 데이터베이스에 데이터가 안 보여요

**A**:
1. 학번이 맞는지 확인 (SQL의 `student_id` 부분)
2. QR 체크인이 성공했는지 확인
3. Heartbeat가 실제로 발생했는지 콘솔 확인
4. Supabase 프로젝트가 맞는지 확인

---

## 🏆 완료 체크리스트

테스트를 모두 완료했다면 체크해주세요!

- [ ] 서버 실행 성공
- [ ] 스마트폰 접속 성공
- [ ] QR 스캔 및 체크인 성공
- [ ] 콘솔에서 PDR 로그 확인
- [ ] 제자리/걷기 테스트 완료
- [ ] 실내/실외 전환 테스트 완료
- [ ] 데이터베이스 확인 완료
- [ ] (선택) 거리 정확도 테스트 완료
- [ ] 테스트 결과 기록 작성

**축하합니다! 🎉**
PDR 시스템이 정상적으로 작동하고 있습니다.

---

## 📞 도움이 필요하면?

- 에러 메시지를 복사해서 팀원이나 담당자에게 공유
- 테스트 결과 양식을 작성해서 제출
- GitHub Issues에 문제 리포트

**마지막 업데이트**: 2025-10-30
**문서 버전**: 1.0
