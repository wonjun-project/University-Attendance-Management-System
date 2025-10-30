# PDR 시스템 테스트 가이드 (학생용)

> 💡 **이 문서는**: 오늘 추가한 GPS-PDR 융합 시스템이 제대로 작동하는지 학생들끼리 테스트하는 방법입니다.
> ⏱️ **소요 시간**: 약 15-20분
> 🌐 **테스트 사이트**: https://university-attendance-management-sy.vercel.app

---

## 📱 준비물

- [ ] 스마트폰 (GPS 지원)
- [ ] 인터넷 연결
- [ ] 실외 공간 접근 가능 (건물 밖)
- [ ] 실내 공간 접근 가능 (건물 안)

---

## 🎯 테스트 목표

오늘 추가한 **GPS-PDR 융합 시스템**이 다음을 제대로 하는지 확인:

1. ✅ GPS + PDR 융합 모드로 작동하는가?
2. ✅ 실내/실외 환경을 자동으로 감지하는가?
3. ✅ 30초마다 위치 추적이 되는가?
4. ✅ 걸어다닐 때 위치가 업데이트되는가?
5. ✅ 데이터베이스에 PDR 정보가 저장되는가?

---

## 🚀 테스트 방법

### 1단계: 출석 체크하기 (3분)

1. **스마트폰**으로 https://university-attendance-management-sy.vercel.app 접속
2. **학생 로그인**: `stu001` / `stu001`
3. (교수가 먼저 QR 생성 필요: `prof001` / `prof001`)
4. **QR 스캔** 후 출석 체크 완료

---

### 2단계: 스마트폰 브라우저 콘솔 열기 (5분)

**이게 가장 중요합니다!** PDR이 작동하는지 보려면 **콘솔**을 열어야 합니다.

#### 📱 iPhone (Safari)

1. **Mac에서**:
   - Safari 열기 → 메뉴바 "개발" 클릭
   - "개발" 메뉴가 안 보이면: Safari > 설정 > 고급 > "메뉴 막대에서 개발자용 메뉴 보기" 체크

2. **iPhone에서**:
   - 설정 > Safari > 고급 > "웹 속성" 켜기

3. **연결**:
   - iPhone을 Mac에 USB 연결
   - Mac Safari > 개발 > [내 iPhone] > 출석 페이지 선택
   - 콘솔 탭 클릭

#### 📱 Android (Chrome)

1. **스마트폰에서**:
   - Chrome 주소창에 `chrome://inspect` 입력
   - 또는 설정 > 개발자 옵션 > USB 디버깅 켜기

2. **PC에서**:
   - Chrome 열기
   - 주소창에 `chrome://inspect` 입력
   - 스마트폰을 USB로 연결
   - "Inspect" 버튼 클릭

#### 🆘 콘솔 못 열겠으면?

서버 로그로 대신 확인 가능 (개발자에게 문의)

---

### 3단계: PDR 융합 모드 확인 (2분)

**콘솔에서 찾아볼 메시지:**

#### ✅ 성공 시 보이는 메시지들:

```
🔄 GPS+PDR Fusion Manager 초기화 중...
✅ GPS+PDR Fusion 초기화 완료: { initialPosition: {...}, accuracy: 12.5 }
```

**이 메시지가 나오면 → PDR 융합 시스템 작동 중! ✅**

#### 30초 후 (Heartbeat):

```
💓 Heartbeat [foreground]: 김학생 (37.123456, 127.123456) [fusion, outdoor, conf: 0.85]
```

**확인 포인트:**
- `[fusion, ...]` ← 이게 **fusion**이면 GPS+PDR 융합 중!
- `outdoor` 또는 `indoor` ← 환경 자동 감지 작동!
- `conf: 0.85` ← 신뢰도 (0.5-1.0 사이면 정상)

---

### 4단계: 실내/실외 전환 테스트 (10분) ⭐ 중요!

이게 **PDR 시스템의 핵심 기능**입니다!

#### A. 실외에서 시작 (건물 밖)

1. **건물 밖**으로 나가기 (운동장, 주차장 등)
2. **30초 대기** (Heartbeat 1회)
3. **콘솔 확인**:
   ```
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.85]
   또는
   💓 Heartbeat: ... [gps-only, outdoor, conf: 0.90]
   ```

**체크:**
- [ ] `outdoor` 표시 확인
- [ ] 메시지가 30초마다 나오는지 확인

#### B. 건물 안으로 이동

1. **건물 안으로** 들어가기 (강의실, 복도)
2. **1-2분 대기** (Heartbeat 2-4회)
3. **콘솔 확인** - 환경이 바뀌는지 주목!
   ```
   // 처음엔 outdoor
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.70]

   // 1-2분 후 자동으로 indoor로 변경!
   💓 Heartbeat: ... [fusion, indoor, conf: 0.65]
   또는
   💓 Heartbeat: ... [pdr-only, indoor, conf: 0.60]
   ```

**체크:**
- [ ] `outdoor` → `indoor`로 자동 변경 확인
- [ ] `pdr-only` 또는 `fusion` 모드인지 확인

#### C. 다시 실외로

1. **건물 밖**으로 나가기
2. **1-2분 대기**
3. **콘솔 확인**:
   ```
   💓 Heartbeat: ... [fusion, outdoor, conf: 0.82]
   ```

**체크:**
- [ ] `indoor` → `outdoor`로 다시 변경 확인

---

### 5단계: 걷기 테스트 (선택, 5분)

**목적**: 걸어다닐 때 PDR이 위치를 업데이트하는지 확인

1. **시작 위치 기록**:
   ```
   💓 Heartbeat: (37.123456, 127.123456) ...
   ```
   → 위도/경도 메모

2. **10-20걸음** 걷기 (10-15m 정도)

3. **30초 대기** → Heartbeat 1회

4. **위치 변경 확인**:
   ```
   💓 Heartbeat: (37.123567, 127.123789) ...
   ```
   → 위도/경도가 바뀌었으면 성공!

---

### 6단계: 데이터베이스 확인 (선택, 5분)

**개발자나 관리자가 확인**

Supabase SQL Editor에서:

```sql
SELECT
  created_at AS 시간,
  tracking_mode AS 모드,
  environment AS 환경,
  confidence AS 신뢰도,
  gps_weight AS GPS가중치,
  pdr_weight AS PDR가중치
FROM location_logs
WHERE attendance_id IN (
  SELECT id FROM attendances
  WHERE student_id = 'stu001'
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY created_at DESC
LIMIT 20;
```

**확인 포인트:**
- [ ] `모드`에 값이 있음 (null 아님)
- [ ] `환경`이 'outdoor' 또는 'indoor'
- [ ] `신뢰도`가 0.5-1.0 사이
- [ ] 데이터가 30초마다 1개씩 생성됨

---

## ✅ 테스트 결과 판정

### 🎉 성공 (PDR 시스템 정상 작동)

다음이 **모두** 확인되면 성공:

- [x] `✅ GPS+PDR Fusion 초기화 완료` 메시지 확인
- [x] 30초마다 Heartbeat 메시지 나옴
- [x] `[fusion, ...]` 또는 `[pdr-only, ...]` 표시
- [x] `outdoor` / `indoor` 환경 자동 감지
- [x] 실외 → 실내 → 실외 전환 시 자동으로 환경 변경

### ⚠️ 부분 성공

다음이 확인되면 부분 성공 (GPS만 작동):

- [x] Heartbeat는 나오지만
- [ ] `[gps-only, ...]`로만 표시
- [ ] 환경 감지는 되지만 fusion 안 됨

→ PDR 센서가 작동하지 않는 것. 센서 권한 확인 필요.

### ❌ 실패

- [ ] `GPS+PDR Fusion 초기화` 메시지 안 나옴
- [ ] Heartbeat가 30초마다 안 나옴
- [ ] 환경이 계속 `unknown`

→ 개발자에게 문의

---

## 🔧 자주 발생하는 문제

### 문제 1: "Fusion 초기화" 메시지가 안 나옴

**원인**: PDR이 비활성화됨

**확인**:
```javascript
// 콘솔에서 찾아보기
⚠️ PDR Fusion 비활성화: GPS 전용 모드 사용
```

**해결**: 개발자가 설정 확인 필요

### 문제 2: 환경이 계속 'unknown'

**원인**: GPS 신호가 너무 약함

**해결**:
1. 건물 밖으로 나가기
2. 1-2분 대기 (GPS 신호 안정화)
3. 비행기 모드 껐다 켜기

### 문제 3: tracking_mode가 계속 'gps-only'

**원인**:
- 실외에서 GPS 신호가 너무 좋음 (정상)
- 또는 PDR 센서가 작동 안 함

**확인**: 건물 안으로 들어가서 재확인
- 건물 안에서도 'gps-only'면 → PDR 문제
- 건물 안에서 'fusion' 또는 'pdr-only'로 바뀌면 → 정상

---

## 📋 테스트 보고서 양식

테스트 완료 후 작성:

```markdown
## PDR 시스템 테스트 결과

**테스트 일시**: 2025-10-30 14:00
**테스터**: 홍길동
**기기**: iPhone 14 / Galaxy S23
**테스트 장소**: 캠퍼스 A동 + 운동장

### 1. PDR 융합 초기화
- [ ] `GPS+PDR Fusion 초기화 완료` 메시지 확인
- [ ] 초기 GPS 정확도: _____m

### 2. Heartbeat 작동
- [ ] 30초마다 메시지 나옴
- [ ] tracking_mode 표시됨: fusion / pdr-only / gps-only

### 3. 실내/실외 전환
- [ ] 실외: environment = 'outdoor'
- [ ] 실내 이동 후: environment = 'indoor'
- [ ] 다시 실외: environment = 'outdoor'

### 4. 종합 판정
- [ ] ✅ 성공 - PDR 시스템 정상 작동
- [ ] ⚠️ 부분 성공 - GPS만 작동 (PDR 안 됨)
- [ ] ❌ 실패 - 작동 안 함

### 발견된 문제
- (있으면 작성)

### 특이사항
- (있으면 작성)
```

---

## 🎓 참고: PDR 시스템이란?

**간단히:**
- **GPS**: 실외에서 정확, 실내에서 부정확
- **PDR**: 스마트폰 센서로 걸음 세서 위치 계산
- **융합**: 둘을 합쳐서 실내외 모두 정확하게!

**오늘 추가한 기능:**
1. GPS Kalman Filter (GPS 노이즈 제거)
2. PDR Tracker (걸음 감지 및 추적)
3. Complementary Filter (GPS와 PDR 융합)
4. Environment Detector (실내/실외 자동 감지)

**기대 효과:**
- 위치 정확도 30-50% 향상
- 실내에서도 연속 추적 가능
- GPS 신호 약해도 센서로 보완

---

## 📞 문제 신고

테스트 중 문제 발견 시:

1. **콘솔 메시지 스크린샷** 찍기
2. **어떤 상황**에서 발생했는지 메모
3. **테스트 보고서** 작성
4. 개발자/관리자에게 전달

---

**사이트**: https://university-attendance-management-sy.vercel.app
**문서 업데이트**: 2025-10-30
**버전**: 4.0 (PDR 테스트용)
